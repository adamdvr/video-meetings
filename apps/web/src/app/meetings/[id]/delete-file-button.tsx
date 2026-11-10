'use client';

import TrashBin from '@gravity-ui/icons/TrashBin';
import { AlertDialog, Button, useOverlayState } from '@heroui/react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { deleteMeetingFile } from './actions';

export function DeleteFileButton({
  meetingId,
  fileId,
  name,
}: {
  meetingId: string;
  fileId: string;
  name: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const deleted = useRef(false);
  const dialog = useOverlayState({
    onOpenChange: (isOpen) => {
      if (!isOpen) setError(null);
    },
  });

  useEffect(
    () => () => {
      if (deleted.current) document.getElementById('files')?.focus();
    },
    [],
  );

  const confirm = () =>
    startTransition(async () => {
      const result = await deleteMeetingFile(meetingId, fileId);
      if (result) {
        setError(result.error);
      } else {
        deleted.current = true;
        dialog.close();
      }
    });

  return (
    <>
      <Button
        aria-label={`Удалить ${name}`}
        className="shrink-0 max-sm:size-11"
        isIconOnly
        onPress={dialog.open}
        size="sm"
        variant="ghost"
      >
        <TrashBin aria-hidden="true" className="size-4" />
      </Button>
      <AlertDialog.Backdrop
        isOpen={dialog.isOpen}
        onOpenChange={(isOpen) => {
          if (!isPending) dialog.setOpen(isOpen);
        }}
      >
        <AlertDialog.Container>
          <AlertDialog.Dialog className="sm:max-w-[420px]">
            <AlertDialog.Header>
              <AlertDialog.Icon status="danger" />
              <AlertDialog.Heading>Удалить файл?</AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>
              <p className="wrap-anywhere">
                Файл «{name}» будет удалён из встречи без возможности
                восстановления.
              </p>
              {error && (
                <p
                  className="mt-3 text-sm text-danger-soft-foreground"
                  role="alert"
                >
                  {error}
                </p>
              )}
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button isDisabled={isPending} slot="close" variant="tertiary">
                Отмена
              </Button>
              <Button
                className="dark:[--button-bg-hover:oklch(0.5_0.2_25)] dark:[--button-bg:oklch(0.55_0.2_25)]"
                isPending={isPending}
                onPress={confirm}
                variant="danger"
              >
                Удалить
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </>
  );
}
