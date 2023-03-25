// const github = require('@actions/github')

import * as github from '@actions/github'

import * as core from '@actions/core'
import {Octokit} from '@octokit/rest'

import * as path from 'path'
import * as fs from 'fs'

import {wppostAync} from 'wp-post'

interface ResultData {
  baseRef: string
  headRef: string
  repoOwner: string
  repoName: string
  changedFiles: string[]
  markdowns: string[]
  targets: string[]
  posts: PostData[]
}

interface PostData {
  postId: string
  file: string
}

;(async () => {
  try {
    //
    const workspace = process.env.GITHUB_WORKSPACE || ''
    // inputs
    const token = core.getInput('token', {required: true})
    const apiUrl = core.getInput('apiUrl', {required: true})
    const authUser = core.getInput('authUser', {required: true})
    const authPassword = core.getInput('authPassword', {required: true})

    const excludes = (core.getInput('exclude') || '').split(',')

    //
    const context = github.context

    // Get the base and head refs
    const baseRef = context.payload.before
    const headRef = context.payload.after

    // Get the repository owner and name
    const repoOwner = context.repo.owner
    const repoName = context.repo.repo

    // Get the changed files
    const octokit = new Octokit({auth: token})
    //  const octokit = github.getOctokit(token)

    const {owner, repo} = github.context.repo
    const {before, after} = github.context.payload

    const listFilesResponse = await octokit.repos.compareCommits({
      owner,
      repo,
      base: before,
      head: after
    })

    //
    const result: ResultData = {
      baseRef: baseRef,
      headRef: headRef,
      repoOwner: repoOwner,
      repoName: repoName,
      changedFiles: [],
      markdowns: [],
      targets: [],
      posts: []
    }

    //
    core.setOutput('workspace', workspace)

    core.setOutput('apiUrl', apiUrl)
    core.setOutput('authUser', authUser)
    core.setOutput('authPassword', authPassword)
    core.setOutput('exclude', excludes.join(','))

    if (listFilesResponse.data.files != null) {
      //
      const changedFiles = listFilesResponse.data.files
        .map(file => file.filename)
        .map(a => path.join(workspace, a))
        .filter(a => fs.existsSync(a))

      //
      const markdowns = changedFiles.filter(a => path.extname(a) === '.md')
      //
      const targets = markdowns.filter(
        a => !excludes.includes(path.basename(a))
      )

      //
      result.changedFiles = changedFiles
      result.markdowns = markdowns
      result.targets = targets
      //
      core.setOutput('changedFiles', changedFiles.join(','))
      core.setOutput('changedFiles-number', changedFiles.length)
      core.setOutput('markdowns', markdowns.join(','))
      core.setOutput('markdowns-number', markdowns.length)
      core.setOutput('targets', targets.join(','))
      core.setOutput('targets-number', targets.length)

      for (const file of targets) {
        //
        const postId: string = await wppostAync(
          file,
          apiUrl,
          authUser,
          authPassword
        )
        result.posts.push({
          postId: postId,
          file: file
        })
      }
    }
    //
    core.setOutput(
      'posts',
      result.posts.map(a => JSON.stringify(a, null, 0)).join(',')
    )
    core.setOutput('posts-number', result.posts.length)
    //
    core.setOutput('result', JSON.stringify(result, null, 0))
  } catch (error) {
    const e: Error = error as Error
    core.setFailed(e.message)
  }
})()
