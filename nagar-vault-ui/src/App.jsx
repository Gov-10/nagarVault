import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  BusFront,
  Check,
  CheckCircle2,
  ChevronDown,
  Clipboard,
  Code2,
  Copy,
  Database,
  Droplets,
  FileAudio,
  FileImage,
  FileVideo,
  HeartPulse,
  KeyRound,
  LoaderCircle,
  MessageSquareWarning,
  RefreshCw,
  Send,
  Server,
  ShieldCheck,
  TrafficCone,
  UploadCloud,
  X,
} from "lucide-react";
import { isDemoMode, submitIngestion } from "./api/ingestion.js";

const PRESETS = {
  nmc: {
    label: "NMC complaint",
    Icon: MessageSquareWarning,
    prefix: "NMC",
    sourceSystem: "mock-citizen-app",
    sensitivity: "restricted",
    eventTypes: [
      ["nmc.complaint.created", "Complaint created"],
      ["nmc.complaint.updated", "Complaint updated"],
    ],
    payload: {
      category: "waterlogging",
      description: "Road par paani bhar gaya hai, traffic ruk gaya hai.",
      citizen: {
        name: "Mock Citizen",
        phone: "9999999999",
      },
      status: "open",
    },
  },
  traffic: {
    label: "Traffic event",
    Icon: TrafficCone,
    prefix: "TRF",
    sourceSystem: "mock-traffic-system",
    sensitivity: "internal",
    eventTypes: [
      ["traffic.congestion.detected", "Congestion detected"],
      ["traffic.accident.reported", "Accident reported"],
    ],
    payload: {
      junction: "Wardha Road x Ajni Square",
      severity: "high",
      averageSpeedKmph: 8,
      vehicleCount: 123,
      cameraId: "CAM-WR-12",
      rainDetected: true,
    },
  },
  water: {
    label: "Water reading",
    Icon: Droplets,
    prefix: "WTR",
    sourceSystem: "mock-water-scada",
    sensitivity: "internal",
    eventTypes: [
      ["water.sensor.reading", "Sensor reading"],
      ["water.alert.raised", "Water alert"],
    ],
    payload: {
      sensorId: "WTR-SENSOR-089",
      assetName: "Gorewada Feeder Line",
      pressureBar: 3.2,
      flowLpm: 450,
      levelCm: 120,
      status: "normal",
    },
  },
  health: {
    label: "Health camp",
    Icon: HeartPulse,
    prefix: "CAMP",
    sourceSystem: "mock-health-portal",
    sensitivity: "internal",
    eventTypes: [
      ["health.camp.status", "Camp status"],
      ["health.camp.capacity", "Capacity update"],
    ],
    payload: {
      facilityName: "Community Health Centre",
      services: ["general-checkup", "vaccination"],
      capacity: 200,
      registeredPatients: 185,
      waitingPatients: 42,
      averageWaitMinutes: 65,
    },
  },
  transport: {
    label: "EV bus telemetry",
    Icon: BusFront,
    prefix: "BUS",
    sourceSystem: "mock-ev-fleet",
    sensitivity: "internal",
    eventTypes: [
      ["ev.bus.telemetry", "Bus telemetry"],
      ["ev.bus.breakdown", "Breakdown event"],
    ],
    payload: {
      busId: "BUS-EV-021",
      routeId: "ROUTE-12",
      speedKmph: 26,
      batterySoc: 54,
      passengerCount: 38,
      status: "in-service",
    },
  },
};

function localDateTimeValue(date = new Date()) {
  const adjusted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return adjusted.toISOString().slice(0, 16);
}

function makeRecordId(preset) {
  return `${preset.prefix}-2026-${Math.floor(100000 + Math.random() * 900000)}`;
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function iconForFile(file) {
  if (file.type.startsWith("image/")) return FileImage;
  if (file.type.startsWith("audio/")) return FileAudio;
  return FileVideo;
}

function App() {
  const [domain, setDomain] = useState("nmc");
  const preset = PRESETS[domain];
  const [eventType, setEventType] = useState(preset.eventTypes[0][0]);
  const [sourceSystem, setSourceSystem] = useState(preset.sourceSystem);
  const [recordId, setRecordId] = useState(makeRecordId(preset));
  const [occurredAt, setOccurredAt] = useState(localDateTimeValue());
  const [wardId, setWardId] = useState("ZONE-5");
  const [sensitivity, setSensitivity] = useState(preset.sensitivity);
  const [payloadText, setPayloadText] = useState(JSON.stringify(preset.payload, null, 2));
  const [files, setFiles] = useState([]);
  const [uploadStates, setUploadStates] = useState({});
  const [isDragging, setIsDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  const payloadResult = useMemo(() => {
    try {
      return { valid: true, value: JSON.parse(payloadText) };
    } catch (parseError) {
      return { valid: false, error: parseError.message };
    }
  }, [payloadText]);

  const eventPreview = useMemo(
    () => ({
      schemaVersion: "1.0",
      department: domain,
      eventType,
      sourceSystem,
      sourceRecordId: recordId,
      occurredAt: occurredAt ? new Date(occurredAt).toISOString() : null,
      sensitivity,
      location: { wardId },
      payload: payloadResult.valid ? payloadResult.value : "INVALID_JSON",
      attachments: files.map((file, index) => ({
        originalName: file.name,
        contentType: file.type,
        size: file.size,
        uploadMode: "presigned-put",
        status: uploadStates[index]?.status || "ready",
      })),
    }),
    [domain, eventType, files, occurredAt, payloadResult, recordId, sensitivity, sourceSystem, uploadStates, wardId],
  );

  function selectPreset(key) {
    const next = PRESETS[key];
    setDomain(key);
    setEventType(next.eventTypes[0][0]);
    setSourceSystem(next.sourceSystem);
    setSensitivity(next.sensitivity);
    setRecordId(makeRecordId(next));
    setPayloadText(JSON.stringify(next.payload, null, 2));
    setResponse(null);
    setError("");
    setUploadStates({});
  }

  function resetForm() {
    selectPreset(domain);
    setOccurredAt(localDateTimeValue());
    setWardId("ZONE-5");
    setFiles([]);
  }

  function addFiles(fileList) {
    const incoming = Array.from(fileList);
    const accepted = incoming.filter((file) => /^(image|audio|video)\//.test(file.type));
    if (accepted.length !== incoming.length) {
      setError("Only image, audio, and video files are accepted.");
    } else {
      setError("");
    }
    setFiles((current) => {
      const existing = new Set(current.map((file) => `${file.name}-${file.size}`));
      return [...current, ...accepted.filter((file) => !existing.has(`${file.name}-${file.size}`))].slice(0, 8);
    });
    setUploadStates({});
  }

  async function copyJson() {
    await navigator.clipboard.writeText(JSON.stringify(eventPreview, null, 2));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1300);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setResponse(null);

    if (!payloadResult.valid) {
      setError(`Payload JSON is invalid: ${payloadResult.error}`);
      return;
    }
    if (!recordId.trim() || !sourceSystem.trim() || !occurredAt) {
      setError("Source system, source record ID, and event time are required.");
      return;
    }

    setSubmitting(true);
    setUploadStates(Object.fromEntries(files.map((_, index) => [index, { status: "queued", progress: 0 }])));

    try {
      const result = await submitIngestion(eventPreview, files, (index, update) => {
        setUploadStates((current) => ({
          ...current,
          [index]: { ...current[index], ...update },
        }));
      });
      setResponse(result);
    } catch (requestError) {
      setError(requestError.message || "Dummy event injection failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const uploadLabel = (state = {}) => {
    if (state.status === "signing") return "Requesting signed URL";
    if (state.status === "uploading") return `Uploading ${state.progress || 0}%`;
    if (state.status === "uploaded") return "Uploaded";
    return "Ready";
  };

  return (
    <div className="dev-page">
      <header className="dev-header">
        <div className="brand-line">
          <div className="brand-icon"><Database size={20} /></div>
          <div><strong>NagarVault</strong><span>Mock Data Injector</span></div>
          <b>INTERNAL TOOL</b>
        </div>
        <div className={`connection-pill ${isDemoMode ? "demo" : "connected"}`}>
          <i /> {isDemoMode ? "Demo adapter" : "API connected"}
        </div>
      </header>

      <main className="dev-container">
        <div className="warning-strip">
          <AlertTriangle size={17} />
          <div><strong>Development utility</strong><span>Use synthetic data only. This page is intended for local seeding and API testing.</span></div>
        </div>

        <div className="page-title-row">
          <div><h1>Inject a dummy event</h1><p>Pick a preset, edit the JSON payload, optionally attach media, and send.</p></div>
          <button type="button" className="secondary-button" onClick={resetForm}><RefreshCw size={15} /> Reset form</button>
        </div>

        <div className="dev-grid">
          <form className="dev-card input-card" onSubmit={handleSubmit}>
            <section className="dev-section">
              <div className="dev-section-title"><span>1</span><div><h2>Choose preset</h2><p>Loads a basic dummy payload for the selected department.</p></div></div>
              <div className="preset-grid">
                {Object.entries(PRESETS).map(([key, item]) => {
                  const Icon = item.Icon;
                  return (
                    <button type="button" key={key} className={domain === key ? "selected" : ""} onClick={() => selectPreset(key)}>
                      <Icon size={18} /><span>{item.label}</span>{domain === key && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="dev-section">
              <div className="dev-section-title"><span>2</span><div><h2>Event details</h2><p>Change any field before submitting.</p></div></div>
              <div className="field-grid">
                <label><span>Event type</span><div className="select-box"><select value={eventType} onChange={(event) => setEventType(event.target.value)}>{preset.eventTypes.map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select><ChevronDown size={15} /></div></label>
                <label><span>Source system</span><input value={sourceSystem} onChange={(event) => setSourceSystem(event.target.value)} /></label>
                <label><span>Source record ID</span><div className="input-with-action"><input value={recordId} onChange={(event) => setRecordId(event.target.value)} /><button type="button" title="Generate ID" onClick={() => setRecordId(makeRecordId(preset))}><RefreshCw size={14} /></button></div></label>
                <label><span>Occurred at</span><input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} /></label>
                <label><span>Ward / zone</span><div className="select-box"><select value={wardId} onChange={(event) => setWardId(event.target.value)}>{Array.from({ length: 10 }, (_, index) => index + 1).map((zone) => <option key={zone} value={`ZONE-${zone}`}>Zone {zone}</option>)}</select><ChevronDown size={15} /></div></label>
                <label><span>Sensitivity</span><div className="select-box"><select value={sensitivity} onChange={(event) => setSensitivity(event.target.value)}><option value="public">Public</option><option value="internal">Internal</option><option value="restricted">Restricted / PII</option></select><ChevronDown size={15} /></div></label>
              </div>
            </section>

            <section className="dev-section">
              <div className="dev-section-title payload-title">
                <span>3</span><div><h2>Payload JSON</h2><p>Edit the department-specific dummy values.</p></div>
                <div className={`json-state ${payloadResult.valid ? "valid" : "invalid"}`}>{payloadResult.valid ? <><CheckCircle2 size={13} /> Valid JSON</> : <><X size={13} /> Invalid JSON</>}</div>
              </div>
              <textarea className="payload-editor" spellCheck="false" value={payloadText} onChange={(event) => setPayloadText(event.target.value)} aria-label="Payload JSON" />
            </section>

            <section className="dev-section">
              <div className="dev-section-title"><span>4</span><div><h2>Attachments <em>optional</em></h2><p>Files use the presigned URL flow and upload directly to MinIO.</p></div></div>
              <div
                className={`simple-dropzone ${isDragging ? "dragging" : ""}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(event) => event.preventDefault()}
                onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(event) => { event.preventDefault(); setIsDragging(false); addFiles(event.dataTransfer.files); }}
                role="button"
                tabIndex="0"
                onKeyDown={(event) => { if (event.key === "Enter") fileInputRef.current?.click(); }}
              >
                <input ref={fileInputRef} type="file" hidden multiple accept="image/*,audio/*,video/*" onChange={(event) => addFiles(event.target.files)} />
                <UploadCloud size={22} />
                <div><strong>Choose or drop media files</strong><span>Image, audio, or video · maximum 8 files</span></div>
                <button type="button">Browse</button>
              </div>

              {files.length > 0 && (
                <div className="simple-files">
                  {files.map((file, index) => {
                    const Icon = iconForFile(file);
                    const state = uploadStates[index] || {};
                    return (
                      <div className="simple-file" key={`${file.name}-${file.size}`}>
                        <Icon size={17} />
                        <div className="file-name"><strong>{file.name}</strong><span>{formatBytes(file.size)}</span>{state.status === "uploading" && <i><b style={{ width: `${state.progress}%` }} /></i>}</div>
                        <small className={state.status || "ready"}>{uploadLabel(state)}</small>
                        <button type="button" disabled={submitting} onClick={() => { setFiles((current) => current.filter((item) => item !== file)); setUploadStates({}); }}><X size={15} /></button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            {error && <div className="form-error"><AlertTriangle size={16} /><span>{error}</span></div>}

            <div className="submit-row">
              <span><ShieldCheck size={15} /> Synthetic test data only</span>
              <button type="submit" className="primary-button" disabled={submitting || !payloadResult.valid}>
                {submitting ? <><LoaderCircle className="spin" size={17} /> Sending…</> : <><Send size={16} /> Inject dummy event</>}
              </button>
            </div>
          </form>

          <aside className="dev-side">
            <section className="dev-card route-card">
              <div className="card-heading"><div><KeyRound size={17} /><strong>Request route</strong></div><span>{files.length ? "PRESIGNED UPLOAD" : "JSON ONLY"}</span></div>
              {files.length ? (
                <ol className="simple-route">
                  <li><b>1</b><div><strong>POST /uploads/presign</strong><span>Request one scoped URL per file</span></div></li>
                  <li><b>2</b><div><strong>PUT directly to MinIO</strong><span>Browser uploads file bytes</span></div></li>
                  <li><b>3</b><div><strong>POST /events</strong><span>Commit metadata and object references</span></div></li>
                  <li><b>4</b><div><strong>Publish to Kafka</strong><span>Presigned URLs are not included</span></div></li>
                </ol>
              ) : (
                <ol className="simple-route">
                  <li><b>1</b><div><strong>POST /events</strong><span>Submit the JSON event with attachments: []</span></div></li>
                  <li><b>2</b><div><strong>Publish to Kafka</strong><span>MinIO is skipped</span></div></li>
                </ol>
              )}
            </section>

            <section className="dev-card preview-card">
              <div className="card-heading"><div><Code2 size={17} /><strong>Request preview</strong></div><button type="button" onClick={copyJson}>{copied ? <Check size={14} /> : <Copy size={14} />}{copied ? "Copied" : "Copy"}</button></div>
              <pre>{JSON.stringify(eventPreview, null, 2)}</pre>
            </section>

            <section className={`dev-card response-card ${response ? "has-response" : ""}`}>
              <div className="card-heading"><div><Server size={17} /><strong>Last response</strong></div>{response && <span>202 ACCEPTED</span>}</div>
              {response ? (
                <div className="response-body">
                  <CheckCircle2 size={28} />
                  <strong>Dummy event accepted</strong>
                  <p>Event ID: <code>{response.eventId}</code></p>
                  <pre>{JSON.stringify(response, null, 2)}</pre>
                </div>
              ) : (
                <div className="empty-response"><Clipboard size={24} /><p>The API response will appear here after you inject an event.</p></div>
              )}
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}

export default App;
