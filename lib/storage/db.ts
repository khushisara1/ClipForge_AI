import fs from "fs";
import path from "path";
import { DIRS, ensureDirs } from "./paths";
import { Project, Clip, Transcript, JobStatus } from "@/types";

interface DbSchema {
  projects: Record<string, Project>;
  clips: Record<string, Clip>;
  transcripts: Record<string, Transcript>;
  jobs: Record<string, JobStatus>;
}

const DB_FILE = "database.json";

function getDbFilePath(): string {
  ensureDirs();
  return path.join(DIRS.db, DB_FILE);
}

function readDb(): DbSchema {
  const filePath = getDbFilePath();
  if (!fs.existsSync(filePath)) {
    return {
      projects: {},
      clips: {},
      transcripts: {},
      jobs: {},
    };
  }

  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      projects: parsed.projects || {},
      clips: parsed.clips || {},
      transcripts: parsed.transcripts || {},
      jobs: parsed.jobs || {},
    };
  } catch (error) {
    console.error("Failed to read database, resetting to empty schema:", error);
    return {
      projects: {},
      clips: {},
      transcripts: {},
      jobs: {},
    };
  }
}

function writeDb(data: DbSchema): void {
  ensureDirs();
  const filePath = getDbFilePath();
  const tempPath = `${filePath}.${Date.now()}.tmp`;

  const payload = JSON.stringify(data, null, 2);
  fs.writeFileSync(tempPath, payload, "utf-8");
  fs.renameSync(tempPath, filePath);
}

// ---------------- PROJECTS ----------------

export function saveProject(project: Project): Project {
  const db = readDb();
  const existing = db.projects[project.id];
  const now = new Date().toISOString();

  const updated: Project = {
    ...project,
    updatedAt: now,
    createdAt: existing?.createdAt || project.createdAt || now,
  };

  db.projects[project.id] = updated;
  writeDb(db);
  return updated;
}

export function getProject(id: string): Project | null {
  const db = readDb();
  const project = db.projects[id];
  if (!project) return null;

  // Compute live clipCount
  const clips = Object.values(db.clips).filter((c) => c.projectId === id);
  return {
    ...project,
    clipCount: clips.length,
  };
}

export function listProjects(): Project[] {
  const db = readDb();
  const clips = Object.values(db.clips);

  return Object.values(db.projects)
    .map((project) => ({
      ...project,
      clipCount: clips.filter((c) => c.projectId === project.id).length,
    }))
    .sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
}

export function deleteProject(id: string): boolean {
  const db = readDb();
  const project = db.projects[id];
  if (!project) return false;

  // Remove project file if exists
  if (project.originalPath && fs.existsSync(project.originalPath)) {
    try {
      fs.unlinkSync(project.originalPath);
    } catch (err) {
      console.warn("Failed to delete project video file:", err);
    }
  }

  // Remove audio file
  if (project.audioPath && fs.existsSync(project.audioPath)) {
    try {
      fs.unlinkSync(project.audioPath);
    } catch (err) {
      console.warn("Failed to delete project audio file:", err);
    }
  }

  // Remove all clips for this project
  const projectClips = Object.values(db.clips).filter((c) => c.projectId === id);
  for (const clip of projectClips) {
    if (clip.videoPath && fs.existsSync(clip.videoPath)) {
      try {
        fs.unlinkSync(clip.videoPath);
      } catch (err) {
        console.warn("Failed to delete clip video file:", err);
      }
    }
    delete db.clips[clip.id];
  }

  delete db.transcripts[id];
  delete db.jobs[id];
  delete db.projects[id];

  writeDb(db);
  return true;
}

// ---------------- TRANSCRIPTS ----------------

export function saveTranscript(transcript: Transcript): Transcript {
  const db = readDb();
  db.transcripts[transcript.projectId] = transcript;
  writeDb(db);
  return transcript;
}

export function getTranscript(projectId: string): Transcript | null {
  const db = readDb();
  return db.transcripts[projectId] || null;
}

// ---------------- CLIPS ----------------

export function saveClip(clip: Clip): Clip {
  const db = readDb();
  const existing = db.clips[clip.id];
  const now = new Date().toISOString();

  const updated: Clip = {
    ...clip,
    updatedAt: now,
    createdAt: existing?.createdAt || clip.createdAt || now,
  };

  db.clips[clip.id] = updated;
  writeDb(db);
  return updated;
}

export function getClip(clipId: string): Clip | null {
  const db = readDb();
  return db.clips[clipId] || null;
}

export function getClipsByProject(projectId: string): Clip[] {
  const db = readDb();
  return Object.values(db.clips)
    .filter((clip) => clip.projectId === projectId)
    .sort((a, b) => a.startTime - b.startTime);
}

export function updateClip(
  clipId: string,
  updates: Partial<Omit<Clip, "id" | "projectId">>
): Clip | null {
  const db = readDb();
  const clip = db.clips[clipId];
  if (!clip) return null;

  const updated: Clip = {
    ...clip,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  db.clips[clipId] = updated;
  writeDb(db);
  return updated;
}

export function deleteClip(clipId: string): boolean {
  const db = readDb();
  const clip = db.clips[clipId];
  if (!clip) return false;

  if (clip.videoPath && fs.existsSync(clip.videoPath)) {
    try {
      fs.unlinkSync(clip.videoPath);
    } catch (err) {
      console.warn("Failed to delete clip file:", err);
    }
  }

  delete db.clips[clipId];
  writeDb(db);
  return true;
}

// ---------------- JOB STATUS ----------------

export function updateJobStatus(job: JobStatus): void {
  const db = readDb();
  db.jobs[job.projectId] = {
    ...job,
    updatedAt: new Date().toISOString(),
  };
  writeDb(db);
}

export function getJobStatus(projectId: string): JobStatus | null {
  const db = readDb();
  return db.jobs[projectId] || null;
}
