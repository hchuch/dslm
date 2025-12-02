import cors from 'cors';
import express, { Request, Response } from 'express';

const app = express();
const port = Number(process.env.PORT || 4000);

app.use(cors());
app.use(express.json());

type Item = { id: string; name: string; qty: number };

const items: Item[] = Array.from({ length: 12 }).map((_, i) => ({
  id: String(i + 1),
  name: `Placeholder Item ${i + 1}`,
  qty: Math.floor(Math.random() * 10) + 1,
}));

app.get('/health', (_req: Request, res: Response) => res.json({ ok: true, now: Date.now() }));

app.get('/items', (_req: Request, res: Response<Item[]>) => {
  res.json(items);
});

app.get('/items/:id', (req: Request, res: Response) => {
  const it = items.find((x) => x.id === req.params.id);
  if (!it) return res.status(404).json({ error: 'not found' });
  res.json(it);
});

app.post('/items', (req: Request, res: Response) => {
  const { name, qty } = req.body as Partial<Item>;
  const newItem: Item = { id: String(items.length + 1), name: name || 'New Item', qty: Number(qty || 1) };
  items.push(newItem);
  res.status(201).json(newItem);
});

app.listen(port, () => console.log(`DSLm server listening on http://localhost:${port}`));
