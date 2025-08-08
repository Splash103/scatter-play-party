const Index = () => {
  console.log("Index component is rendering");
  
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white">
      <div className="text-center p-8">
        <h1 className="text-4xl font-bold mb-4 text-gray-900">Welcome to Scattergories!</h1>
        <p className="text-xl text-gray-600 mb-8">The modern multiplayer word game</p>
        <div className="bg-blue-500 text-white px-6 py-3 rounded-lg inline-block">
          Game Coming Soon
        </div>
      </div>
    </div>
  );
};

export default Index;
