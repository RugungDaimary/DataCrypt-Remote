import React, { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { io } from "socket.io-client";
import {
  Upload,
  Download,
  Copy,
  Send,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import axios from "axios";
import debounce from "lodash.debounce";
import JSZip from "jszip";
import { useMediaQuery } from 'react-responsive';

interface User {
  id: string;
  name: string;
  email: string;
  publicKey: string;
}

interface FileTransfer {
  _id?: string;
  id?: string;
  fileName: string;
  fileSize: number;
  sender: {
    name: string;
    email: string;
  };
  recipient: {
    name: string;
    email: string;
  };
  createdAt: string;
  accessLink: string;
  downloaded: boolean;
  filePath?: string;
}
const socket = io(import.meta.env.VITE_API_URL || "http://localhost:5000", {
  withCredentials: true,
});

const handleDownloadBoth = async (transfer: any) => {
  try {
    // Fetch both files as blobs
    const [fileRes, keyRes] = await Promise.all([
      fetch(transfer.encryptedFileUrl),
      fetch(transfer.encryptedKeyUrl),
    ]);
    const fileBlob = await fileRes.blob();
    const keyBlob = await keyRes.blob();

    // Create a zip file
    const zip = new JSZip();
    zip.file(transfer.fileName, fileBlob);
    zip.file("encrypted-key.bin", keyBlob);

    const zipBlob = await zip.generateAsync({ type: "blob" });

    // Trigger download
    const url = window.URL.createObjectURL(zipBlob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${transfer.fileName.replace(/\.[^/.]+$/, "")}_bundle.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  } catch (err) {
    alert("Failed to download files");
  }
};
const Home: React.FC = () => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"send" | "receive">("send");
  const [encryptedFile, setEncryptedFile] = useState<File | null>(null);
  const [encryptedAESKey, setEncryptedAESKey] = useState<File | null>(null);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [recipientPublicKey, setRecipientPublicKey] = useState("");
  const [userFound, setUserFound] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sentFiles, setSentFiles] = useState<FileTransfer[]>([]);
  const [receivedFiles, setReceivedFiles] = useState<FileTransfer[]>([]);
  const encryptedFileInputRef = useRef<HTMLInputElement>(null);
  const aesKeyInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useMediaQuery({ maxWidth: 600 });

  // Fetch received files for the logged-in user
  const fetchReceivedFiles = async () => {
    try {
      const response = await axios.get("/api/transfers/inbox");
      setReceivedFiles(response.data);
    } catch (error) {
      console.error("Failed to fetch received files:", error);
      setError("Failed to retrieve received files");
    }
  };

  // Optionally, fetch sent files if you want to keep that functionality
  const fetchSentFiles = async () => {
    if (!user?.email) return;
    try {
      const response = await axios.get("/api/transfers/sent", {
        params: { email: user.email },
      });
      setSentFiles(response.data);
    } catch (error) {
      console.error("Failed to fetch sent files:", error);
      setError("Failed to retrieve sent files");
    }
  };
  useEffect(() => {
    if (user?.email) {
      // Join the user's personal room
      socket.emit("join", user.email);

      // Listen for new file notifications
      socket.on("new-file", (fileInfo) => {
        fetchReceivedFiles(); // Refresh the inbox
        setSuccess(`New file received: ${fileInfo.fileName}`);
        setTimeout(() => setSuccess(null), 5000);
      });
    }

    // Cleanup on unmount or user change
    return () => {
      if (user?.email) {
        socket.off("new-file");
        socket.emit("leave", user.email);
      }
    };
    // eslint-disable-next-line
  }, [user?.email]);

  // Fetch received files when the component mounts or user email changes
  useEffect(() => {
    if (user?.email) {
      fetchReceivedFiles();
      fetchSentFiles(); // Optional: only if you want to show sent files elsewhere
    }
    // eslint-disable-next-line
  }, [user?.email]);

  const handleEncryptedFileChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files && e.target.files[0]) {
      setEncryptedFile(e.target.files[0]);
    }
  };

  const handleEncryptedAESKeyChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files && e.target.files[0]) {
      setEncryptedAESKey(e.target.files[0]);
    }
  };

  // Real-time debounced user check
  const checkUserExists = async (email: string) => {
    setRecipientPublicKey("");
    if (!email.trim()) {
      setUserFound(null);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(`/api/users/public-key/${email}`);
      if (response.data.publicKey) {
        setUserFound(true);
        setRecipientPublicKey(response.data.publicKey);
      } else {
        setUserFound(false);
        setRecipientPublicKey("");
      }
    } catch (err: any) {
      if (err.response?.status === 404) {
        setUserFound(false);
        setRecipientPublicKey("");
      } else {
        setError("Error checking user");
        setUserFound(null);
        setRecipientPublicKey("");
      }
    } finally {
      setLoading(false);
    }
  };

  const debouncedCheckUserExists = useCallback(
    debounce((email: string) => {
      checkUserExists(email);
    }, 500),
    []
  );

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setRecipientEmail(email);
    setError(null);
    setSuccess(null);
    debouncedCheckUserExists(email);
  };

  const handleSendFile = async () => {
    if (!encryptedFile) {
      setError("Please select the encrypted file to send");
      return;
    }
    if (!encryptedAESKey) {
      setError("Please select the encrypted AES key");
      return;
    }
    if (!recipientEmail) {
      setError("Please enter recipient email");
      return;
    }
    if (!recipientPublicKey) {
      setError("Recipient does not exist");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const formData = new FormData();
      formData.append("encryptedFile", encryptedFile);
      formData.append("encryptedAESKey", encryptedAESKey);
      formData.append("fileName", encryptedFile.name);
      formData.append("recipientEmail", recipientEmail);

      await axios.post("/api/transfers/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setSuccess("Files uploaded successfully");
      setEncryptedFile(null);
      setEncryptedAESKey(null);
      setRecipientEmail("");
      setRecipientPublicKey("");
      setUserFound(null);
      if (encryptedFileInputRef.current) {
        encryptedFileInputRef.current.value = "";
      }
      if (aesKeyInputRef.current) {
        aesKeyInputRef.current.value = "";
      }

      fetchSentFiles();
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to send files");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setSuccess("Copied to clipboard");
    setTimeout(() => setSuccess(null), 3000);
  };

  function isValidDomain(email: string) {
    // Example: allow only gmail.com and company.com
    const allowedDomains = ["dtu.ac.in","gmail.com", "outlook.com", "yahoo.com", "hotmail.com", "icloud.com", "aol.com", "protonmail.com", "zoho.com", "yandex.com", "outlook.com", "yahoo.com", "hotmail.com", "icloud.com", "aol.com", "protonmail.com", "zoho.com", "yandex.com"];
    const match = email.match(/@([\w.-]+)$/);
    return match ? allowedDomains.includes(match[1]) : false;
  }

  const handleSendInvitation = async () => {
    try {
      setLoading(true);
      await axios.post("/api/invite", { email: recipientEmail, senderName: user?.name });
      setSuccess("Invitation sent!");
    } catch (err) {
      setError("Failed to send invitation.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
      <div className="flex border-b border-gray-200">
        <button
          className={`flex-1 py-4 px-6 text-center ${
            activeTab === "send"
              ? "text-indigo-600 border-b-2 border-indigo-600 font-medium"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("send")}
        >
          <Upload className="h-5 w-5 inline-block mr-2" />
          Send Files
        </button>
        <button
          className={`flex-1 py-4 px-6 text-center ${
            activeTab === "receive"
              ? "text-indigo-600 border-b-2 border-indigo-600 font-medium"
              : "text-gray-500 hover:text-gray-700"
          }`}
          onClick={() => setActiveTab("receive")}
        >
          <Download className="h-5 w-5 inline-block mr-2" />
          Received Files
        </button>
      </div>
      <div className="p-6">
        {activeTab === "send" && (
          <div>
            <div className="mb-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Send File
              </h3>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recipient Email
                </label>
                <div className="flex items-center">
                  <input
                    type="email"
                    value={recipientEmail}
                    onChange={handleEmailChange}
                    className="w-full px-3 py-2 text-gray-700 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter recipient's email"
                  />
                </div>
                {loading && (
                  <p className="text-sm text-gray-500 mt-2">Checking...</p>
                )}
                {userFound === true && (
                  <p className="text-sm text-green-600 mt-2">User found!</p>
                )}
                {userFound === false && isValidDomain(recipientEmail) && (
                  <div className="mt-2">
                    <button
                      onClick={handleSendInvitation}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                      disabled={loading}
                    >
                      {loading ? "Sending..." : "Send Invitation for Sign Up"}
                    </button>
                  </div>
                )}
              </div>

              {recipientPublicKey && (
                <div className="mb-4 p-3 bg-blue-50 rounded-md border border-blue-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-medium text-blue-800">
                        Recipient Public Key:
                      </div>
                      <div className="text-sm text-blue-600 mt-1 break-all">
                        {recipientPublicKey}
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(recipientPublicKey)}
                      className="text-blue-500 hover:text-blue-700"
                    >
                      <Copy className="h-5 w-5" />
                    </button>
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 text-sm text-red-600">{error}</div>
              )}

              {/* Encrypted File Upload */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Encrypted File
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="encrypted-file-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                      >
                        <span>Upload Encrypted File</span>
                        <input
                          id="encrypted-file-upload"
                          name="encrypted-file-upload"
                          type="file"
                          className="sr-only"
                          onChange={handleEncryptedFileChange}
                          ref={encryptedFileInputRef}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      Any file up to 100MB
                    </p>
                  </div>
                </div>
                {encryptedFile && (
                  <div className="mt-2 text-sm text-gray-500">
                    Selected file: {encryptedFile.name} (
                    {(encryptedFile.size / 1024 / 1024).toFixed(2)} MB)
                  </div>
                )}
              </div>

              {/* Encrypted AES Key Upload */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Encrypted AES Key
                </label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                  <div className="space-y-1 text-center">
                    <svg
                      className="mx-auto h-12 w-12 text-gray-400"
                      stroke="currentColor"
                      fill="none"
                      viewBox="0 0 48 48"
                      aria-hidden="true"
                    >
                      <path
                        d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                        strokeWidth={2}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <div className="flex text-sm text-gray-600">
                      <label
                        htmlFor="aes-key-upload"
                        className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                      >
                        <span>Upload Encrypted AES Key</span>
                        <input
                          id="aes-key-upload"
                          name="aes-key-upload"
                          type="file"
                          className="sr-only"
                          onChange={handleEncryptedAESKeyChange}
                          ref={aesKeyInputRef}
                        />
                      </label>
                      <p className="pl-1">or drag and drop</p>
                    </div>
                    <p className="text-xs text-gray-500">
                      .key, .bin, or .txt (up to 10KB)
                    </p>
                  </div>
                </div>
                {encryptedAESKey && (
                  <div className="mt-2 text-sm text-gray-500">
                    Selected key: {encryptedAESKey.name} (
                    {(encryptedAESKey.size / 1024).toFixed(2)} KB)
                  </div>
                )}
              </div>

              <div className="flex justify-end">
                <button
                  onClick={handleSendFile}
                  disabled={
                    loading ||
                    !encryptedFile ||
                    !encryptedAESKey ||
                    !recipientEmail ||
                    userFound !== true
                  }
                  className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 flex items-center"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {loading ? "Sending..." : "Send Files"}
                </button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "receive" && (
          <div>
            <div className="mb-4">
              <h3 className="text-lg font-medium text-gray-900 mb-4">
                Received Files
              </h3>
              {receivedFiles.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  You haven't received any files yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          File
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Sender
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Date
                        </th>
                        <th
                          scope="col"
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                        >
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {receivedFiles.map((transfer) => (
                        <tr key={transfer._id || transfer.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">
                              {transfer.fileName}
                            </div>
                            <div className="text-sm text-gray-500">
                              {(transfer.fileSize / 1024 / 1024).toFixed(2)} MB
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm text-gray-900">
                              {transfer.sender.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              {transfer.sender.email}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(transfer.createdAt).toLocaleDateString()}
                          </td>

                          {/* <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              className="text-indigo-600 hover:text-indigo-900 flex items-center"
                              onClick={async () => {
                                try {
                                  const res = await fetch(
                                    transfer.encryptedFileUrl
                                  );
                                  const blob = await res.blob();
                                  const url = window.URL.createObjectURL(blob);
                                  const a = document.createElement("a");
                                  a.href = url;
                                  a.download = transfer.fileName;
                                  document.body.appendChild(a);
                                  a.click();
                                  a.remove();
                                  window.URL.revokeObjectURL(url);
                                } catch (err) {
                                  alert("Failed to download file");
                                }
                              }}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              <span>Download</span>
                            </button>
                          </td> */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            <button
                              className="text-indigo-600 hover:text-indigo-900 flex items-center"
                              onClick={() => handleDownloadBoth(transfer)}
                            >
                              <Download className="h-4 w-4 mr-1" />
                              <span>Download</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {success && (
          <div className="fixed bottom-4 right-4 bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded flex items-center">
            <CheckCircle className="h-5 w-5 mr-2" />
            <span>{success}</span>
          </div>
        )}

        {error && (
          <div className="fixed bottom-4 right-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded flex items-center">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>{error}</span>
          </div>
        )}
      </div>
      
    </div>
  );
};

export default Home;
