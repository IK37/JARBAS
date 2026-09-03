import { cpus, freemem, platform, release, totalmem } from "node:os";
import { spawnSync } from "node:child_process";

const gpu = detectGpu();
const backends = {
  cuda: commandWorks("nvidia-smi", ["--help"]),
  rocm: commandWorks("rocminfo", []),
  vulkan: commandWorks("vulkaninfo", ["--summary"]),
};

console.log(
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      os: { platform: platform(), release: release(), arch: process.arch },
      cpu: { model: cpus()[0]?.model ?? "unknown", logicalCores: cpus().length },
      memory: {
        totalGb: Number((totalmem() / 1024 ** 3).toFixed(2)),
        freeGb: Number((freemem() / 1024 ** 3).toFixed(2)),
      },
      gpu,
      detectedBackends: backends,
    },
    null,
    2,
  ),
);

function detectGpu() {
  const nvidia = run("nvidia-smi", ["--query-gpu=name,memory.total,driver_version", "--format=csv,noheader"]);
  if (nvidia) return { source: "nvidia-smi", detail: nvidia };
  if (process.platform === "win32") {
    const windows = run("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion | ConvertTo-Json -Compress",
    ]);
    if (windows) return { source: "Win32_VideoController", detail: windows };
  }
  const pci = run("lspci", ["-nn"])
    ?.split("\n")
    .filter((line) => /VGA|3D controller/iu.test(line))
    .join("\n");
  return pci ? { source: "lspci", detail: pci } : { source: "none", detail: "GPU not detected" };
}

function commandWorks(command, args) {
  return spawnSync(command, args, { encoding: "utf8", timeout: 5_000 }).status === 0;
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 5_000 });
  return result.status === 0 ? result.stdout.trim() : undefined;
}
