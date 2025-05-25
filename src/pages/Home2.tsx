const BASE_URL = import.meta.env.VITE_API_URL;
import React from 'react';
import { useEffect } from 'react';
import { useState } from 'react';
import axios from 'axios';

const Home2 = () => { 

    const [serverResponse, setServerResponse]  = useState<string | null>(null);

    const fetchResponse = async ()=>{
        try {
            const rsp =  await axios.get(`${BASE_URL}`)
            console.log('rsp.data: ');
            console.log(rsp.data)
            setServerResponse(rsp.data);

            return rsp;
        } catch (error) {
            console.log(error);
        }
    }

    useEffect(()=>{
        fetchResponse();
    },[])

    return (
      <div>
        <div>Home page of frontend loaded</div>
        <div>{serverResponse ? serverResponse : "Loading..."}</div>
      </div>
    );

};

export default Home2;