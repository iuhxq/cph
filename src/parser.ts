import path from 'path';
import fs from 'fs';
import * as vscode from 'vscode';
import crypto from 'crypto';
import { Problem } from './types';
import { getSaveLocationPref } from './preferences';

/**
 * 获取工作区根目录
 */
const getWorkspaceRoot = (): string | undefined => {
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length === 0) {
        return undefined;
    }
    return folders[0].uri.fsPath;
};

/**
 * 获取 CPH 元数据存储根目录
 *
 * 规则：
 * 1. saveLocation 为空：默认存到 工作区根目录/.cph
 * 2. saveLocation 为绝对路径：直接使用
 * 3. saveLocation 为相对路径：相对于工作区根目录
 * 4. 如果没有工作区：退回到源码目录/.cph
 */
const getCphStorageRoot = (srcPath: string): string => {
    const rawPref = getSaveLocationPref();
    const savePreference =
        typeof rawPref === 'string' ? rawPref.trim() : '';

    const workspaceRoot = getWorkspaceRoot();
    const srcFolder = path.dirname(srcPath);

    // 未设置 saveLocation
    if (savePreference === '') {
        if (workspaceRoot) {
            return path.join(workspaceRoot, '.cph');
        }
        return path.join(srcFolder, '.cph');
    }

    // 绝对路径
    if (path.isAbsolute(savePreference)) {
        return savePreference;
    }

    // 相对路径：相对于工作区根目录
    if (workspaceRoot) {
        return path.join(workspaceRoot, savePreference);
    }

    // 没有工作区时，退回源码目录
    return path.join(srcFolder, savePreference);
};

/**
 * 获取 .prob 文件保存路径
 *
 * 文件名格式：
 * .<源码文件名>_<srcPath哈希>.prob
 */
export const getProbSaveLocation = (srcPath: string): string => {
    const srcFileName = path.basename(srcPath);
    const hash = crypto
        .createHash('md5')
        .update(srcPath)
        .digest('hex');

    const baseProbName = `.${srcFileName}_${hash}.prob`;
    const storageRoot = getCphStorageRoot(srcPath);

    return path.join(storageRoot, baseProbName);
};

/** Get the problem for a source, `null` if does not exist on the filesystem. */
export const getProblem = (srcPath: string): Problem | null => {
    const probPath = getProbSaveLocation(srcPath);

    try {
        const problem = fs.readFileSync(probPath).toString();
        return JSON.parse(problem);
    } catch {
        return null;
    }
};

/** Save the problem (metadata) */
export const saveProblem = (srcPath: string, problem: Problem) => {
    const storageRoot = getCphStorageRoot(srcPath);

    if (!fs.existsSync(storageRoot)) {
        globalThis.logger.log('Making CPH storage folder:', storageRoot);
        fs.mkdirSync(storageRoot, { recursive: true });
    }

    const probPath = getProbSaveLocation(srcPath);

    try {
        fs.writeFileSync(probPath, JSON.stringify(problem));
    } catch (err) {
        throw new Error(String(err));
    }
};