import { Request, Response } from "express";
import si from "systeminformation";
import os from "os";
import { ReS, ReE } from "@services/generalHelper.service";
import { SERVER_ERROR_CODE, SUCCESS_CODE } from "@constants/serverCode";

export class SystemController {
  async getUltraSystemStats(req: Request, res: Response) {
    try {
      const [
        cpu,
        cpuTemp,
        cpuSpeed,
        mem,               // swap inside this
        memLayout,
        processes,
        load,
        diskLayout,
        fs,
        diskIO,
        blockDevices,
        networkStats,
        networkInterfaces,
        battery,
        osInfo,
        system,
        users,
        graphics
      ] = await Promise.all([
        si.cpu(),
        si.cpuTemperature(),
        si.cpuCurrentSpeed(),
        si.mem(),              // <-- swap comes from here
        si.memLayout(),
        si.processes(),
        si.currentLoad(),
        si.diskLayout(),
        si.fsSize(),
        si.disksIO(),
        si.blockDevices(),
        si.networkStats(),
        si.networkInterfaces(),
        si.battery(),
        si.osInfo(),
        si.system(),
        si.users(),
        si.graphics(),
      ]);

      const processMem = process.memoryUsage();
      const processUptimeSec = process.uptime();
      const systemUptimeSec = os.uptime();

      const healthScore = this.calculateHealthScore(load, mem);

      const stats = {
        system: {
          manufacturer: system.manufacturer,
          model: system.model,
          version: system.version,
          serial: system.serial,
          uuid: system.uuid,
          virtual: system.virtual,
          osPlatform: osInfo.platform,
          distro: osInfo.distro,
          release: osInfo.release,
          kernel: osInfo.kernel,
          arch: os.arch(),
          hostname: os.hostname(),
          shell: os.userInfo().shell,
          uptimeSec: systemUptimeSec,
        },

        cpu: {
          manufacturer: cpu.manufacturer,
          brand: cpu.brand,
          speedGHz: cpu.speed,
          physicalCores: cpu.physicalCores,
          logicalCores: cpu.cores,
          cache: cpu.cache,
          currentLoad: load.currentLoad.toFixed(2),
          coreLoads: load.cpus.map(c => c.load.toFixed(2)),
          temperature: cpuTemp.main || null,
          speedDetails: cpuSpeed,
        },

        memory: {
          totalMB: (mem.total / 1024 / 1024).toFixed(2),
          usedMB: (mem.used / 1024 / 1024).toFixed(2),
          freeMB: (mem.free / 1024 / 1024).toFixed(2),
          activeMB: (mem.active / 1024 / 1024).toFixed(2),
          cachedMB: (mem.cached / 1024 / 1024).toFixed(2),
          buffersMB: (mem.buffers / 1024 / 1024).toFixed(2),

          // 🔥 CORRECT swap values from TypeScript definitions
          swapTotalMB: (mem.swaptotal / 1024 / 1024).toFixed(2),
          swapUsedMB: (mem.swapused / 1024 / 1024).toFixed(2),
          swapFreeMB: (mem.swapfree / 1024 / 1024).toFixed(2),

          memLayout,
        },

        disk: {
          layout: diskLayout,
          partitions: fs,
          io: diskIO,
          blockDevices,
        },

        network: {
          interfaces: networkInterfaces,
          stats: networkStats,
        },

        gpu: graphics.controllers?.length
          ? graphics.controllers.map(g => ({
              model: g.model,
              vendor: g.vendor,
              vram: g.vram,
              temperature: g.temperatureGpu,
              usagePercent: g.utilizationGpu,
            }))
          : [],

        processes: {
          total: processes.all,
          running: processes.running,
          blocked: processes.blocked,
          sleeping: processes.sleeping,
          listTopCPU: processes.list.slice(0, 10),
          listTopMemory: processes.list.sort((a, b) => b.mem - a.mem).slice(0, 10),
        },

        battery: {
          hasBattery: battery.hasBattery,
          percent: battery.percent,
          isCharging: battery.isCharging,
          voltage: battery.voltage,
        },

        nodeProcess: {
          pid: process.pid,
          uptimeSec: processUptimeSec,
          memory: {
            rss: processMem.rss,
            heapTotal: processMem.heapTotal,
            heapUsed: processMem.heapUsed,
            external: processMem.external,
          },
          cpuUsage: process.cpuUsage(),
          env: process.env.NODE_ENV,
          versions: process.versions,
        },

        performance: {
          loadAvg: os.loadavg(),
          healthScore,
        },

        users: users,
      };

      return ReS(res, SUCCESS_CODE, "Fetched advanced system stats successfully", stats);

    } catch (err) {
      return ReE(
        res,
        SERVER_ERROR_CODE,
        "Failed to fetch advanced system stats: " + (err as Error).message
      );
    }
  }

  private calculateHealthScore(load: any, mem: any) {
    const cpuScore = Math.max(0, 100 - load.currentLoad);
    const memUsage = (mem.active / mem.total) * 100;
    const memScore = Math.max(0, 100 - memUsage);
    return ((cpuScore + memScore) / 2).toFixed(2);
  }
}
