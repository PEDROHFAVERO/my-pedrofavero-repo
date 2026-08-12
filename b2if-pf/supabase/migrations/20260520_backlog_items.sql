CREATE TABLE IF NOT EXISTS public.backlog_items (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id     TEXT,
  titulo      TEXT NOT NULL,
  descricao   TEXT,
  o_que       TEXT,
  por_que     TEXT,
  como        TEXT,
  area        TEXT,
  prioridade  TEXT DEFAULT 'media',
  esforco     TEXT DEFAULT 'medio',
  sprint      TEXT DEFAULT '—',
  status      TEXT DEFAULT 'backlog',
  criado_por  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_backlog_status     ON public.backlog_items(status);
CREATE INDEX IF NOT EXISTS idx_backlog_prioridade ON public.backlog_items(prioridade);
CREATE INDEX IF NOT EXISTS idx_backlog_area       ON public.backlog_items(area);

CREATE OR REPLACE FUNCTION update_backlog_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_backlog_updated_at ON public.backlog_items;
CREATE TRIGGER trg_backlog_updated_at
  BEFORE UPDATE ON public.backlog_items
  FOR EACH ROW EXECUTE FUNCTION update_backlog_updated_at();

ALTER TABLE public.backlog_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "backlog_select" ON public.backlog_items;
DROP POLICY IF EXISTS "backlog_insert" ON public.backlog_items;
DROP POLICY IF EXISTS "backlog_update" ON public.backlog_items;
DROP POLICY IF EXISTS "backlog_delete" ON public.backlog_items;

CREATE POLICY "backlog_select" ON public.backlog_items FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "backlog_insert" ON public.backlog_items FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "backlog_update" ON public.backlog_items FOR UPDATE USING (auth.role() = 'authenticated');
CREATE POLICY "backlog_delete" ON public.backlog_items FOR DELETE USING (auth.role() = 'authenticated');
