import { fileURLToPath, pathToFileURL } from 'url'
import c from 'picocolors'
import { isPackageExists } from 'local-pkg'
import { dirname, resolve } from 'pathe'
import type { Suite, Task } from '../types'
import { getNames, slash } from './tasks'

export * from './tasks'
export * from './path'

export const isWindows = process.platform === 'win32'

/**
 * Partition in tasks groups by consecutive concurrent
 */
export function partitionSuiteChildren(suite: Suite) {
  let tasksGroup: Task[] = []
  const tasksGroups: Task[][] = []
  for (const c of suite.tasks) {
    if (tasksGroup.length === 0 || c.concurrent === tasksGroup[0].concurrent) {
      tasksGroup.push(c)
    }
    else {
      tasksGroups.push(tasksGroup)
      tasksGroup = [c]
    }
  }
  if (tasksGroup.length > 0)
    tasksGroups.push(tasksGroup)

  return tasksGroups
}

export function getFullName(task: Task) {
  return getNames(task).join(c.dim(' > '))
}

export async function ensurePackageInstalled(
  dependency: string,
  promptInstall = !process.env.CI && process.stdout.isTTY,
) {
  if (isPackageExists(dependency))
    return true

  process.stderr.write(c.red(`${c.inverse(c.red(' MISSING DEP '))} Can not find dependency '${dependency}'\n\n`))

  if (!promptInstall)
    return false

  const prompts = await import('prompts')
  const { install } = await prompts.prompt({
    type: 'confirm',
    name: 'install',
    message: c.reset(`Do you want to install ${c.green(dependency)}?`),
  })

  if (install) {
    await (await import('@antfu/install-pkg')).installPackage(dependency, { dev: true })
    return true
  }

  return false
}

export function isObject(item: unknown): boolean {
  return item != null && typeof item === 'object' && !Array.isArray(item)
}

function deepMergeArray(target: any[] = [], source: any[] = []) {
  const mergedOutput = Array.from(target)

  source.forEach((sourceElement, index) => {
    const targetElement = mergedOutput[index]

    if (Array.isArray(target[index])) {
      mergedOutput[index] = deepMergeArray(target[index], sourceElement)
    }
    else if (isObject(targetElement)) {
      mergedOutput[index] = deepMerge(target[index], sourceElement)
    }
    else {
      // Source does not exist in target or target is primitive and cannot be deep merged
      mergedOutput[index] = sourceElement
    }
  })

  return mergedOutput
}

export function deepMerge(target: any, source: any): any {
  if (isObject(target) && isObject(source)) {
    const mergedOutput = { ...target }
    Object.keys(source).forEach((key) => {
      if (isObject(source[key]) && !source[key].$$typeof) {
        if (!(key in target)) Object.assign(mergedOutput, { [key]: source[key] })
        else mergedOutput[key] = deepMerge(target[key], source[key])
      }
      else if (Array.isArray(source[key])) {
        mergedOutput[key] = deepMergeArray(target[key], source[key])
      }
      else {
        Object.assign(mergedOutput, { [key]: source[key] })
      }
    })

    return mergedOutput
  }
  else if (Array.isArray(target) && Array.isArray(source)) {
    return deepMergeArray(target, source)
  }
  return target
}

export function toFilePath(id: string, root: string): string {
  let absolute = slash(id).startsWith('/@fs/')
    ? id.slice(4)
    : id.startsWith(dirname(root))
      ? id
      : id.startsWith('/')
        ? slash(resolve(root, id.slice(1)))
        : id

  if (absolute.startsWith('//'))
    absolute = absolute.slice(1)

  // disambiguate the `<UNIT>:/` on windows: see nodejs/node#31710
  return isWindows && absolute.startsWith('/')
    ? fileURLToPath(pathToFileURL(absolute.slice(1)).href)
    : absolute
}

export { resolve as resolvePath }
