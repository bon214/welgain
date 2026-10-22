import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent, PointerEvent, RefObject } from 'react';

type Axis = 'body' | 'chart';
type Layout = Record<Axis, number>;
type IconName =
  | 'model'
  | 'graph'
  | 'grid'
  | 'reset'
  | 'move'
  | 'check'
  | 'help';
function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, string> = {
    model:
      'M9 4a3 3 0 1 0 6 0 3 3 0 0 0-6 0m3 3v7m-7-4 7-2 7 2m-7 4-4 7m4-7 4 7',
    graph: 'M4 3v17h17M7 14l4-5 4 3 5-7',
    grid: 'M4 4h16v16H4ZM12 4v16m0-6h8',
    reset: 'M3 10a9 9 0 1 1 2 8M3 4v6h6',
    move: 'M12 3v18M3 12h18m-12-6 3-3 3 3m-6 12 3 3 3-3M6 9l-3 3 3 3m12-6 3 3-3 3',
    check: 'm5 12 4 4L19 6',
    help: 'M9.1 8a3 3 0 0 1 5.8 1c0 2-3 2-3 4m0 3v.1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0',
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

const PRESETS = [
  { id: 'standard', name: '標準', icon: 'grid', body: 50, chart: 64 },
  { id: 'graph', name: 'グラフ重視', icon: 'graph', body: 32, chart: 76 },
  { id: 'model', name: 'モデル重視', icon: 'model', body: 68, chart: 52 },
] as const;
const LIMITS = { body: [26, 72], chart: [30, 78] } as const;
const STORAGE_KEY = 'welgain.frame-layout.v1';
function readSettings() {
  const fallback = { body: 50, chart: 64, snapping: true };
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (
      value &&
      (['body', 'chart'] as const).every(
        (axis) =>
          typeof value[axis] === 'number' &&
          Number.isFinite(value[axis]) &&
          value[axis] >= LIMITS[axis][0] &&
          value[axis] <= LIMITS[axis][1],
      )
    ) {
      return {
        body: value.body as number,
        chart: value.chart as number,
        snapping: typeof value.snapping === 'boolean' ? value.snapping : true,
      };
    }
  } catch {
    /* Storage is optional. */
  }
  return fallback;
}
function useSize(ref: RefObject<HTMLDivElement | null>) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) =>
      setSize({
        width: Math.round(entry.contentRect.width),
        height: Math.round(entry.contentRect.height),
      }),
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return `${size.width} × ${size.height}`;
}

export default function App() {
  const [settings] = useState(readSettings);
  const [layout, setLayout] = useState<Layout>({
    body: settings.body,
    chart: settings.chart,
  });
  const [snapping, setSnapping] = useState(settings.snapping);
  const [dragging, setDragging] = useState<Axis | null>(null);
  const [saved, setSaved] = useState(true);
  const [showHelp, setShowHelp] = useState(false);
  const frameRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const modelRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<HTMLDivElement>(null);
  const iconsRef = useRef<HTMLDivElement>(null);
  const modelSize = useSize(modelRef);
  const chartSize = useSize(chartRef);
  const iconsSize = useSize(iconsRef);
  const preset = PRESETS.find(
    (item) => item.body === layout.body && item.chart === layout.chart,
  );

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...layout, snapping }),
      );
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, [layout, snapping]);

  function resize(axis: Axis, value: number, snap = snapping) {
    const [min, max] = LIMITS[axis];
    let next = Math.max(min, Math.min(max, value));
    if (snap) {
      const target = PRESETS.map((item) => item[axis]).find(
        (point) => Math.abs(point - next) <= 2,
      );
      if (target !== undefined) next = target;
    }
    setLayout((previous) => ({ ...previous, [axis]: Math.round(next) }));
  }
  function drag(event: PointerEvent<HTMLDivElement>, axis: Axis) {
    if (dragging !== axis) return;
    const rect = (
      axis === 'body' ? frameRef : rightRef
    ).current?.getBoundingClientRect();
    if (!rect) return;
    // The separator occupies 22 px. Its center follows the pointer exactly.
    const length = (axis === 'body' ? rect.width : rect.height) - 22;
    const offset =
      axis === 'body' ? event.clientX - rect.left : event.clientY - rect.top;
    resize(axis, ((offset - 11) / length) * 100, snapping && !event.shiftKey);
  }
  function keyboardResize(event: KeyboardEvent<HTMLDivElement>, axis: Axis) {
    let value: number;
    const step = event.shiftKey ? 10 : 2;
    if (event.key === 'Home') value = LIMITS[axis][0];
    else if (event.key === 'End') value = LIMITS[axis][1];
    else if (event.key === (axis === 'body' ? 'ArrowLeft' : 'ArrowUp'))
      value = layout[axis] - step;
    else if (event.key === (axis === 'body' ? 'ArrowRight' : 'ArrowDown'))
      value = layout[axis] + step;
    else return;
    event.preventDefault();
    resize(axis, value, false);
  }
  function separator(axis: Axis) {
    return (
      <div
        className={`splitter ${axis === 'body' ? 'vertical' : 'horizontal'} ${dragging === axis ? 'dragging' : ''}`}
        role="separator"
        tabIndex={0}
        aria-label={
          axis === 'body'
            ? 'モデルとグラフの分割バー'
            : 'グラフとアイコン群の分割バー'
        }
        aria-orientation={axis === 'body' ? 'vertical' : 'horizontal'}
        aria-valuemin={LIMITS[axis][0]}
        aria-valuemax={LIMITS[axis][1]}
        aria-valuenow={layout[axis]}
        aria-valuetext={`${layout[axis]}パーセント`}
        title="ドラッグでサイズ変更。矢印キーで微調整、ダブルクリックで標準サイズに戻す。"
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.currentTarget.focus();
          event.currentTarget.setPointerCapture(event.pointerId);
          setDragging(axis);
        }}
        onPointerMove={(event) => drag(event, axis)}
        onPointerUp={(event) => {
          if (event.currentTarget.hasPointerCapture(event.pointerId))
            event.currentTarget.releasePointerCapture(event.pointerId);
          setDragging(null);
        }}
        onLostPointerCapture={() => setDragging(null)}
        onPointerCancel={() => setDragging(null)}
        onKeyDown={(event) => keyboardResize(event, axis)}
        onDoubleClick={() => resize(axis, PRESETS[0][axis], false)}
      >
        <span className="splitter-line" />
        <span className="splitter-grip">
          <i />
          <i />
          <i />
        </span>
      </div>
    );
  }
  function reset() {
    setLayout({ body: 50, chart: 64 });
    setSnapping(true);
  }

  return (
    <div className={`app-shell ${dragging ? `resizing-${dragging}` : ''}`}>
      <header className="site-header">
        <a className="brand" href="#" aria-label="welgain ホーム">
          <span className="brand-mark">
            <svg viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <path
                d="m8 14 5 13 7-11 7 11 5-13"
                stroke="currentColor"
                strokeWidth="3.7"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          welgain<span className="brand-studio">/ playground</span>
        </a>
        <div className="header-right">
          <span className="prototype-tag">
            <i />
            FRAME RESIZE DEMO
          </span>
          <button
            className={`help-button ${showHelp ? 'active' : ''}`}
            onClick={() => setShowHelp(!showHelp)}
            aria-expanded={showHelp}
            aria-controls="help-content"
          >
            <Icon name="help" size={18} />
            <span>操作方法</span>
          </button>
        </div>
      </header>
      <main>
        <section className="page-heading">
          <div>
            <p className="eyebrow">YOUR SPACE, YOUR BALANCE</p>
            <h1>
              見やすいサイズに、<span>ドラッグ。</span>
            </h1>
          </div>
          <p className="heading-note">
            <Icon name="move" size={17} />
            <span>
              縦・横の境界を動かして
              <br />
              <strong>3つのフレームを自由に調整</strong>
            </span>
          </p>
        </section>
        {showHelp && (
          <section
            id="help-content"
            className="help-panel"
            aria-label="操作方法"
          >
            <p>
              <strong>ドラッグ</strong>
              中央の縦バーで左右の幅、右側の横バーで上下の高さを変えられます。タッチ操作にも対応。
            </p>
            <p>
              <strong>スナップ</strong>
              標準・グラフ重視・モデル重視の比率に近づくと吸着します。Shift
              を押しながらドラッグすると一時的に解除できます。
            </p>
            <p>
              <strong>キーボード</strong>
              分割バーを選択して矢印キーで2%、Shift＋矢印キーで10%ずつ調整。ダブルクリックで標準に戻せます。
            </p>
          </section>
        )}
        <section className="workspace" aria-label="フレームサイズ変更デモ">
          <div className="workspace-toolbar">
            <span className="session-id">
              0000<span>LAYOUT</span>
            </span>
            <div
              className="preset-group"
              role="group"
              aria-label="レイアウトプリセット"
            >
              {PRESETS.map((item) => (
                <button
                  key={item.id}
                  data-testid={`preset-${item.id}`}
                  className={`preset-button ${preset?.id === item.id ? 'selected' : ''}`}
                  aria-pressed={preset?.id === item.id}
                  onClick={() =>
                    setLayout({ body: item.body, chart: item.chart })
                  }
                >
                  <Icon name={item.icon} size={21} />
                  <span>{item.name}</span>
                </button>
              ))}
            </div>
            <button
              className="reset-button"
              aria-label="標準レイアウトに戻す"
              onClick={reset}
            >
              <Icon name="reset" size={17} />
              <span>リセット</span>
            </button>
          </div>
          <div
            className="frames"
            ref={frameRef}
            data-testid="frames"
            style={{
              gridTemplateColumns: `minmax(0, ${layout.body}fr) 22px minmax(0, ${100 - layout.body}fr)`,
            }}
          >
            <div
              className="frame model-frame"
              ref={modelRef}
              data-testid="model-frame"
            >
              <div className="frame-topline">
                <span>
                  <i />
                  FRAME 01
                </span>
                <span className="size-readout">{modelSize}</span>
              </div>
              <div className="frame-center">
                <span className="frame-symbol">
                  <Icon name="model" size={37} />
                </span>
                <h2>3Dモデル</h2>
                <p>MODEL VIEW</p>
              </div>
              <div className="frame-bottomline">
                <span>WIDTH</span>
                <strong>
                  {layout.body}
                  <small>%</small>
                </strong>
              </div>
              <div className="corner-cross" aria-hidden="true">
                +
              </div>
            </div>
            {separator('body')}
            <div
              className="right-frames"
              ref={rightRef}
              style={{
                gridTemplateRows: `minmax(0, ${layout.chart}fr) 22px minmax(0, ${100 - layout.chart}fr)`,
              }}
            >
              <div
                className="frame graph-frame"
                ref={chartRef}
                data-testid="graph-frame"
              >
                <div className="graph-grid" aria-hidden="true">
                  <span className="zero-line" />
                </div>
                <div className="frame-topline">
                  <span>
                    <i />
                    FRAME 02
                  </span>
                  <span className="size-readout">{chartSize}</span>
                </div>
                <div className="graph-ticks" aria-hidden="true">
                  <span>100°</span>
                  <span>0°</span>
                  <span>−100°</span>
                </div>
                <div className="frame-center">
                  <h2>グラフ</h2>
                  <p>GRAPH VIEW</p>
                </div>
                <div className="frame-bottomline">
                  <span>HEIGHT</span>
                  <strong>
                    {layout.chart}
                    <small>%</small>
                  </strong>
                </div>
              </div>
              {separator('chart')}
              <div
                className="frame icons-frame"
                ref={iconsRef}
                data-testid="icons-frame"
              >
                <div className="icons-heading">
                  <span>FRAME 03</span>
                  <h2>アイコン群</h2>
                  <span className="size-readout">{iconsSize}</span>
                </div>
                <div className="icons-content">
                  <div className="placeholder-icons" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                  </div>
                  <p>アイコン群</p>
                </div>
              </div>
            </div>
          </div>
          <div className="workspace-footer">
            <div className="save-status">
              <span className={saved ? 'saved-icon' : ''}>
                <Icon name={saved ? 'check' : 'help'} size={14} />
              </span>
              <span>
                {saved ? 'レイアウトを自動保存' : 'レイアウトは保存されません'}
                <small>このブラウザ内のみ</small>
              </span>
            </div>
            <p className="layout-status" aria-live="polite">
              {dragging ? '調整中' : preset?.name || 'カスタム'}
              <span>/</span>
              <strong>モデル {layout.body}%</strong>
              <span>·</span>
              <strong>グラフ {layout.chart}%</strong>
            </p>
            <div className="snap-setting">
              <span>スナップ</span>
              <button
                className={`toggle ${snapping ? 'on' : ''}`}
                role="switch"
                aria-checked={snapping}
                aria-label="サイズをスナップ"
                onClick={() => setSnapping(!snapping)}
              >
                <span />
              </button>
            </div>
          </div>
        </section>
        <footer className="page-footer">
          <span>
            <Icon name="move" size={13} />
            境界をドラッグしてサイズを変更
          </span>
          <span>
            レイアウト操作のみのプロトタイプ
            <span className="footer-dot">·</span>3D表示・計測機能は含みません
          </span>
        </footer>
      </main>
    </div>
  );
}
