import { useState } from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog'
import { Button } from '../ui/button'
import { toast } from '../ui/toast'
import {
  forgetDeviceDirectoryHandle,
  pickLocalWorkspaceDirectory,
} from '../../services/localWorkspace'
import { mirrorCurrentCloudWorkspaceToLocal } from '../../services/workspaceManager'
import { useWorkspaceStore } from '../../stores/useWorkspaceStore'

export function MissingMirrorModal() {
  const { isMirrorFolderMissing, setMirrorFolderMissing, bumpWorkspaceRevision } = useWorkspaceStore()
  const [isProcessing, setIsProcessing] = useState(false)

  if (!isMirrorFolderMissing) return null

  const handleKeepCloudOnly = async () => {
    setIsProcessing(true)
    try {
      await forgetDeviceDirectoryHandle()
      setMirrorFolderMissing(false)
      bumpWorkspaceRevision()
      toast.add({
        title: 'Switched to cloud-only mode',
        description: 'Your Google Drive files remain completely safe.',
        type: 'info',
        priority: 'low',
      })
    } catch {
      toast.add({
        title: 'Failed to update workspace settings',
        type: 'error',
        priority: 'high',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleChooseNewFolder = async () => {
    setIsProcessing(true)
    try {
      const picked = await pickLocalWorkspaceDirectory()
      if (picked) {
        await mirrorCurrentCloudWorkspaceToLocal(picked.handle)
        setMirrorFolderMissing(false)
        bumpWorkspaceRevision()
        toast.add({
          title: `Mirrored to "${picked.name}" successfully`,
          type: 'success',
          priority: 'low',
        })
      }
    } catch {
      toast.add({
        title: 'Could not select a new mirror folder',
        type: 'error',
        priority: 'high',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={isMirrorFolderMissing} onOpenChange={(open) => !open && handleKeepCloudOnly()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-500">
            <ExclamationTriangleIcon className="h-6 w-6" />
          </div>
          <DialogTitle className="text-center text-lg font-semibold">
            Mirrored Local Folder Not Found
          </DialogTitle>
          <DialogDescription className="text-center text-muted-foreground text-sm">
            The local folder linked to this workspace was moved, renamed, or deleted on your computer.
            Your notes and files in Google Drive are completely safe.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="outline"
            onClick={handleKeepCloudOnly}
            disabled={isProcessing}
            className="w-full sm:w-auto"
          >
            Keep in Cloud Only
          </Button>
          <Button
            variant="default"
            onClick={handleChooseNewFolder}
            disabled={isProcessing}
            className="w-full sm:w-auto"
          >
            Choose New Folder
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
