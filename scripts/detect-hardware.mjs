import { cpus, freemem, platform, release, totalmem } from "node:os";
import { spawnSync } from "node:child_process";

const gpu = detectGpu();
const systemBackendTools = {
  nvidiaSmi: probeCommand("nvidia-smi", ["--help"]),
  rocminfo: probeCommand("rocminfo", []),
  vulkaninfo: probeCommand("vulkaninfo", ["--summary"])
};
const runtimeCommands = {
  ollama: probeVersion("ollama", ["--version"]),
  llamaCpp: probeVersion("llama-server", ["--version"])
};

console.log(
  JSON.stringify(
    {
      capturedAt: new Date().toISOString(),
      os: { platform: platform(), release: release(), arch: process.arch },
      cpu: {
        model: cpus()[0]?.model ?? "unknown",
        logicalCores: cpus().length
      },
      memory: {
        totalGb: Number((totalmem() / 1024 ** 3).toFixed(2)),
        freeGb: Number((freemem() / 1024 ** 3).toFixed(2))
      },
      gpu,
      systemBackendTools,
      runtimeCommands,
      notes: [
        "System tool availability does not prove or disprove a backend bundled by a runtime.",
        ...(process.platform === "win32"
          ? [
              "Win32_VideoController.AdapterRAM is a 32-bit field and is not reliable for GPUs with more than 4 GiB."
            ]
          : [])
      ]
    },
    null,
    2
  )
);

function detectGpu() {
  const nvidia = run("nvidia-smi", [
    "--query-gpu=name,memory.total,driver_version",
    "--format=csv,noheader"
  ]);
  if (nvidia) return { source: "nvidia-smi", detail: nvidia };
  if (process.platform === "win32") {
    const windows = run("powershell.exe", [
      "-NoProfile",
      "-Command",
      "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM,DriverVersion,VideoProcessor,PNPDeviceID | ConvertTo-Json -Compress"
    ]);
    if (windows) {
      return {
        source: "Win32_VideoController",
        devices: parseWindowsVideoControllers(windows),
        adapterRamReliable: false
      };
    }
  }
  const pci = run("lspci", ["-nn"])
    ?.split("\n")
    .filter((line) => /VGA|3D controller/iu.test(line))
    .join("\n");
  return pci
    ? { source: "lspci", detail: pci }
    : { source: "none", detail: "GPU not detected" };
}

function parseWindowsVideoControllers(payload) {
  try {
    const parsed = JSON.parse(payload);
    const devices = Array.isArray(parsed) ? parsed : [parsed];
    return devices.flatMap((device) => {
      if (typeof device !== "object" || device === null) return [];
      return [
        {
          name: readOptionalString(device.Name) ?? "unknown",
          reportedAdapterRamBytes: readOptionalNumber(device.AdapterRAM),
          driverVersion: readOptionalString(device.DriverVersion),
          videoProcessor: readOptionalString(device.VideoProcessor),
          pnpDeviceId: readOptionalString(device.PNPDeviceID)
        }
      ];
    });
  } catch {
    return [{ name: "unknown", rawProbe: payload }];
  }
}

function readOptionalString(value) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function readOptionalNumber(value) {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function probeCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 5_000
  });
  return { command, available: result.status === 0 };
}

function probeVersion(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    timeout: 5_000
  });
  if (result.status !== 0) return { command, available: false };
  return {
    command,
    available: true,
    version: `${result.stdout}${result.stderr}`.trim() || "unknown"
  };
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", timeout: 5_000 });
  return result.status === 0 ? result.stdout.trim() : undefined;
}
