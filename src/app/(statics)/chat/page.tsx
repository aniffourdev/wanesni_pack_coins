// pages/index.tsx
import type { NextPage } from "next";
import Chat from "@/components/Chat";

const Home: NextPage = () => {
  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <Chat />
    </div>
  );
};

export default Home;
