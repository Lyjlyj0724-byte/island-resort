import { regionOrder } from './regionLayout';
import { Component, Suspense, lazy, useEffect, useRef, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import {
  ArrowUpRight,
  Bike,
  Camera,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Compass,
  Expand,
  Eye,
  EyeOff,
  Footprints,
  Heart,
  Landmark,
  MapPin,
  Minus,
  Mountain,
  Palmtree,
  Plus,
  RotateCcw,
  Shrink,
  Sun,
  TreePine,
  Utensils,
  Volume2,
  VolumeX,
  Waves,
  Wine,
  X,
} from 'lucide-react';
import {
  ChiangMaiIcon,
  ClimbingIcon,
  KarstRiverIcon,
  LandscapeReflectionIcon,
  PingPongIcon,
} from './TravelIcons';
import { regions, regionSpots, spots } from './data';
import type { Spot } from './data';
import { site } from '../site';

import './resort.css';
import type { ResortView } from './views';
import SeaAmbience from './SeaAmbience';
import BirthdayCakeIllustration from './BirthdayCakeIllustration';
import BirthdayLetter from './BirthdayLetter';
import TimeControls from './TimeControls';
import type { TimeMode } from './dayCycle';

// The 3D scene is loaded lazily so the header, copy and photo cards paint first.
const World = lazy(() => import('./ResortWorld'));

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return (
        <div className="resort-recovery">
          <h2>海风稍等一下</h2>
          <p>3D 场景暂时没有加载成功，照片和下方地点入口仍可以使用。</p>
          <button onClick={() => location.reload()}>重新加载场景</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ICONS: Record<Spot, ComponentType<{ size?: number | string }>> = {
  dining: Utensils,
  pingpong: PingPongIcon,
  surf: Waves,
  sunset: Sun,
  garden: Palmtree,
  river: Waves,
  karst: LandscapeReflectionIcon,
  climb: ClimbingIcon,
  scooter: Bike,
  birthday: Heart,
  suthep: Mountain,
  trail: Footprints,
  temple: Landmark,
  foresttemple: TreePine,
  san: Wine,
  taste: Coffee,
  moonpond: Waves,
  huizhou: Landmark,
  lakeside: TreePine,
  courtyard: Heart,
};

// Four-step celebration shown in the seaside table spot. Every line comes from site.ts.
function Celebration() {
  const [step, setStep] = useState(0);
  const [letter, setLetter] = useState(false);
  const copy = site.celebration;

  return (
    <div className="resort-birthday">
      <span className="resort-eyebrow">{copy.eyebrow}</span>
      <h2>{copy.titles[step]}</h2>
      <BirthdayCakeIllustration lit={step > 0 && step < 3} celebrating={step === 3} />
      <p>{step === 3 ? copy.finalLine : copy.line}</p>
      {step < 3 ? (
        <button className="resort-primary" onClick={() => setStep((next) => next + 1)}>
          {copy.buttons[step]} <Heart size={16} />
        </button>
      ) : (
        <>
          <BirthdayLetter open={letter} onToggle={() => setLetter((open) => !open)} />
          <button
            className="resort-quiet"
            onClick={() => {
              setStep(0);
              setLetter(false);
            }}
          >
            {copy.again}
          </button>
        </>
      )}
    </div>
  );
}

type ScenePanelProps = {
  spot: Spot;
  onClose: () => void;
  onInspect: (view: ResortView) => void;
};

// A photo card for one spot. Focus is trapped while it is open and restored on close.
function ScenePanel({ spot, onClose, onInspect }: ScenePanelProps) {
  const [index, setIndex] = useState(0);
  const [photoExpanded, setPhotoExpanded] = useState(false);
  const panel = useRef<HTMLElement>(null);
  const info = spots[spot];
  const photo = info.photos[index];
  const isLongPhoto = !!photo && photo.height > photo.width * 1.7;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      if (event.key === 'Tab') {
        const focusable = panel.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,canvas[tabindex]',
        );
        if (!focusable?.length) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === panel.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      previous?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="resort-overlay">
      <button className="resort-shade" aria-label="关闭照片" tabIndex={-1} onClick={onClose} />
      <section
        ref={panel}
        tabIndex={-1}
        className={'resort-panel panel-' + spot}
        role="dialog"
        aria-modal="true"
        aria-label={info.title}
      >
        <button className="resort-close" onClick={onClose} aria-label="回到场景">
          <X size={20} />
        </button>
        <span className="resort-eyebrow">{info.en}</span>
        <h2>{info.title}</h2>
        <p className="resort-panel-intro">{info.description}</p>
        {info.inspect && (
          <div className="inspect-actions">
            <button className="resort-primary inspect-bar" onClick={() => onInspect(spot as ResortView)}>
              {info.inspect} <ArrowUpRight size={16} />
            </button>
            {spot === 'dining' && (
              <button className="resort-quiet inspect-bar" onClick={() => onInspect('pool')}>
                去泳池边看看
              </button>
            )}
          </div>
        )}
        {spot === 'birthday' ? (
          <Celebration />
        ) : (
          photo && (
            <>
              {!isLongPhoto && (
                <button
                  className="photo-expand"
                  aria-expanded={photoExpanded}
                  onClick={() => setPhotoExpanded((open) => !open)}
                >
                  {photoExpanded ? <Shrink size={14} /> : <Expand size={14} />}{' '}
                  {photoExpanded ? '收起照片' : '展开照片看细节'}
                </button>
              )}
              <figure className={'scene-photo' + (isLongPhoto || photoExpanded ? ' photo-expanded' : '')}>
                <img src={photo.src} alt={photo.caption} width={photo.width} height={photo.height} />
                <figcaption>{photo.caption}</figcaption>
              </figure>
              {info.photos.length > 1 && (
                <div className="photo-pagination">
                  <button
                    aria-label="上一张照片"
                    onClick={() =>
                      setIndex((current) => (current + info.photos.length - 1) % info.photos.length)
                    }
                  >
                    <ChevronLeft size={19} />
                  </button>
                  <span>
                    {index + 1} / {info.photos.length}
                  </span>
                  <button
                    aria-label="下一张照片"
                    onClick={() => setIndex((current) => (current + 1) % info.photos.length)}
                  >
                    <ChevronRight size={19} />
                  </button>
                </div>
              )}
            </>
          )
        )}
      </section>
    </div>
  );
}

// After leaving a photo panel, require a fresh gesture before a scene can reopen it.
export default function ResortApp() {
  const sceneSelectionBlocked = useRef(false);
  const markersRoot = useRef<HTMLDivElement>(null);
  const [entered, setEntered] = useState(false);
  const [region, setRegion] = useState<keyof typeof regions>('chiangmai');
  const [selected, setSelected] = useState<Spot | null>(null);
  const [timeMode, setTimeMode] = useState<TimeMode>('auto');
  const [sound, setSound] = useState(false);
  const [reset, setReset] = useState(0);
  const [closeup, setCloseup] = useState<ResortView>(null);
  const [zoom, setZoom] = useState(0);
  const [showMarkers, setShowMarkers] = useState(true);
  const audio = useRef<HTMLAudioElement>(null);
  const ocean = useRef<SeaAmbience | null>(null);

  const startOcean = (nextRegion: keyof typeof regions = region) => {
    if (nextRegion !== 'sabah') return;
    ocean.current ??= new SeaAmbience();
    void ocean.current.play().catch(() => {});
  };

  const toggleAudio = () => {
    if (sound) {
      ocean.current?.pause();
      setSound(false);
    } else {
      if (entered) startOcean();
      setSound(true);
    }
  };

  useEffect(
    () => () => {
      ocean.current?.dispose();
      ocean.current = null;
    },
    [],
  );

  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    element.volume = site.music.volume;
    const sync = () => {
      if (sound && entered && !document.hidden) {
        element.play().catch(() => setSound(false));
        if (region === 'sabah') ocean.current?.play().catch(() => {});
        else ocean.current?.pause();
      } else {
        element.pause();
        ocean.current?.pause();
      }
    };
    sync();
    document.addEventListener('visibilitychange', sync);
    return () => document.removeEventListener('visibilitychange', sync);
  }, [entered, sound, region]);

  return (
    <main
      className="resort-app"
      data-time={timeMode}
      onPointerDownCapture={() => {
        sceneSelectionBlocked.current = false;
      }}
      onKeyDownCapture={() => {
        sceneSelectionBlocked.current = false;
      }}
    >
      <audio ref={audio} src={site.music.src} loop preload="none" />
      <div className="resort-canvas">
        <SceneBoundary>
          <Suspense fallback={<div className="resort-loading">{site.loading}</div>}>
            <World
              onSelect={(id) => {
                if (!entered || !showMarkers || sceneSelectionBlocked.current) return;
                if (spots[id].region !== region && closeup !== 'islands') setCloseup(null);
                if (sound && entered) startOcean(spots[id].region);
                setRegion(spots[id].region);
                setSelected(id);
              }}
              timeMode={timeMode}
              running={entered}
              interactive={entered && !selected && showMarkers}
              reset={reset}
              zoom={zoom}
              closeup={closeup}
              region={region}
              markersRoot={markersRoot}
            />
          </Suspense>
        </SceneBoundary>
      </div>
      <div className="resort-vignette" />
      <div className="resort-marker-layer" ref={markersRoot} />
      <header className="resort-header">
        <button
          className="resort-brand"
          onClick={() => {
            setSelected(null);
            setCloseup(null);
            setReset((value) => value + 1);
          }}
          aria-label="回到当前地点全景"
        >
          <span>
            {site.brand.name} <i>{site.brand.mark}</i>
          </span>
          <small>{site.brand.caption}</small>
        </button>
        <div className="resort-tools">
          <button
            aria-label="纯观景模式"
            title={showMarkers ? '隐藏标记，安心观看造景' : '恢复标记与照片互动'}
            aria-pressed={!showMarkers}
            onClick={() => setShowMarkers((visible) => !visible)}
          >
            {showMarkers ? <Eye size={18} /> : <EyeOff size={18} />}
          </button>
          <button aria-label="放大场景" onClick={() => setZoom((value) => value + 1)}>
            <Plus size={18} />
          </button>
          <button aria-label="缩小场景" onClick={() => setZoom((value) => value - 1)}>
            <Minus size={18} />
          </button>
          <button aria-label={sound ? '关闭声音' : '开启旅行音乐'} onClick={toggleAudio}>
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <TimeControls mode={timeMode} onChange={setTimeMode} />
          <button
            aria-label="恢复全景视角"
            onClick={() => {
              setCloseup(null);
              setReset((value) => value + 1);
            }}
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </header>
      {!entered ? (
        <section className="resort-welcome">
          <span className="resort-eyebrow">{site.welcome.eyebrow}</span>
          <h1>
            {site.welcome.title.map((line) => (
              <span key={line}>
                {line}
                <br />
              </span>
            ))}
          </h1>
          <p>
            {site.welcome.body.map((line) => (
              <span key={line}>
                {line}
                <br />
              </span>
            ))}
          </p>
          <button
            className="resort-primary"
            onClick={() => {
              setEntered(true);
              if (sound) startOcean();
            }}
          >
            {site.welcome.action} <ArrowUpRight size={17} />
          </button>
          <small>{site.welcome.hint}</small>
        </section>
      ) : (
        <>
          <div className="resort-places">
            <nav className="region-switch" aria-label="切换旅行地点">
              {regionOrder.map((place) => (
                <button
                  key={place}
                  aria-pressed={region === place && closeup !== 'islands'}
                  onClick={() => {
                    if (sound) startOcean(place);
                    setRegion(place);
                    setCloseup(null);
                    setSelected(null);
                    setReset((value) => value + 1);
                  }}
                >
                  {place === 'sabah' ? (
                    <Palmtree size={14} />
                  ) : place === 'hongcun' ? (
                    <Landmark size={14} />
                  ) : place === 'chiangmai' ? (
                    <ChiangMaiIcon size={14} />
                  ) : (
                    <KarstRiverIcon size={14} />
                  )}{' '}
                  {regions[place].name}
                </button>
              ))}
              <button
                className="journey-overview"
                aria-label="查看四地全景"
                aria-pressed={closeup === 'islands'}
                onClick={() => {
                  setCloseup('islands');
                  setReset((value) => value + 1);
                }}
              >
                <Compass size={14} />
                <span>四地全景</span>
              </button>
            </nav>
            <div className="resort-location">
              <MapPin size={12} />
              <span>{closeup === 'islands' ? '把四地山海，放在一起' : regions[region].location}</span>
            </div>
          </div>
          <nav className="resort-dock" aria-label="旅途里的地点">
            {regionSpots[region].map((id) => {
              const Icon = ICONS[id];
              return (
                <button key={id} onClick={() => setSelected(id)}>
                  <Icon size={19} />
                  <span>{spots[id].nav}</span>
                </button>
              );
            })}
          </nav>
          <div className="resort-hint">
            <Camera size={13} />{' '}
            {showMarkers ? '点相机或场景看照片 · 拖动环顾' : '纯观景 · 拖动环顾 · 滚轮或双指缩放'}
          </div>
        </>
      )}
      {selected && (
        <ScenePanel
          key={selected}
          spot={selected}
          onClose={() => {
            sceneSelectionBlocked.current = true;
            setSelected(null);
          }}
          onInspect={(view) => {
            sceneSelectionBlocked.current = true;
            setSelected(null);
            setCloseup(view);
            setReset((value) => value + 1);
          }}
        />
      )}
      <footer className="resort-credit">
        {site.footer.left} <span>·</span> {site.footer.right}
      </footer>
    </main>
  );
}
