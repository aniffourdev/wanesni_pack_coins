import PackList from '@/components/PackList';

export default function HomePage() {
  return (
    <main className="max-w-2xl mx-auto p-6">
      <h1 className="text-3xl font-black mb-6 text-center uppercase">Buy Coin Packs</h1>
      <PackList />
    </main>
  );
}
