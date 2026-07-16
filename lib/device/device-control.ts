export type LocalDeviceControlCommand = {
  commandId: string;
  type: "LOGOUT" | "WIPE";
  requestedAt: string | Date;
};

export type ExecuteDeviceControlsOptions = {
  commands: readonly LocalDeviceControlCommand[];
  clearEncryptedDeviceData: () => Promise<number>;
  clearDeviceKeys: () => Promise<number>;
  clearAdditionalLocalData?: () => Promise<void>;
  acknowledge: (commandId: string) => Promise<void>;
  logout: () => Promise<void>;
};

export async function executeDeviceControls(options: ExecuteDeviceControlsOptions) {
  const commands = [...options.commands].sort(compareCommands);
  const logoutCommands = commands.filter((command) => command.type === "LOGOUT");
  const wipeCommand = commands.find((command) => command.type === "WIPE");

  for (const command of logoutCommands) {
    await options.acknowledge(command.commandId);
  }

  if (wipeCommand) {
    const encryptedRecordCount = await options.clearEncryptedDeviceData();
    const keyCount = await options.clearDeviceKeys();
    await options.clearAdditionalLocalData?.();
    await options.acknowledge(wipeCommand.commandId);
    await options.logout();
    return {
      action: "WIPE" as const,
      encryptedRecordCount,
      keyCount,
      acknowledgedCommandIds: [...logoutCommands.map((command) => command.commandId), wipeCommand.commandId],
    };
  }

  if (logoutCommands.length) {
    await options.logout();
    return {
      action: "LOGOUT" as const,
      acknowledgedCommandIds: logoutCommands.map((command) => command.commandId),
    };
  }

  return { action: "NONE" as const, acknowledgedCommandIds: [] };
}

function compareCommands(left: LocalDeviceControlCommand, right: LocalDeviceControlCommand) {
  if (left.type !== right.type) return left.type === "LOGOUT" ? -1 : 1;
  const timeDifference = new Date(left.requestedAt).getTime() - new Date(right.requestedAt).getTime();
  return timeDifference || left.commandId.localeCompare(right.commandId);
}
