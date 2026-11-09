'use client';

import ArrowRotateRight from '@gravity-ui/icons/ArrowRotateRight';
import ArrowUpFromLine from '@gravity-ui/icons/ArrowUpFromLine';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import FileIcon from '@gravity-ui/icons/File';
import Xmark from '@gravity-ui/icons/Xmark';
import { Button, Card, ProgressBar } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type ReactNode } from 'react';
import {
  DropZone,
  Text,
  type DropZoneProps,
} from 'react-aria-components/DropZone';
import { FileTrigger } from 'react-aria-components/FileTrigger';
import { FILE_FORMATS, rejectionOf, uploadErrorOf } from '@/lib/file-rules';
import { formatFileSize } from '@/lib/file-size';

const MAX_PARALLEL_UPLOADS = 3;

enum UploadStatus {
  Queued = 'queued',
  Uploading = 'uploading',
  Saving = 'saving',
  Done = 'done',
  Error = 'error',
  Cancelled = 'cancelled',
  Rejected = 'rejected',
  Unconfirmed = 'unconfirmed',
}

type Upload = {
  key: string;
  file: File;
  status: UploadStatus;
  progress: number;
  fileId?: string;
  reason?: string;
};

function announcementOf(name: string, patch: Partial<Upload>) {
  switch (patch.status) {
    case UploadStatus.Done:
      return `Файл «${name}» загружен`;
    case UploadStatus.Cancelled:
      return `Загрузка «${name}» отменена`;
    case UploadStatus.Unconfirmed:
      return `«${name}»: ${patch.reason}`;
    default:
      return `Не удалось загрузить «${name}»: ${patch.reason}`;
  }
}

export function FileUpload({
  meetingId,
  fileIds,
  children,
}: {
  meetingId: string;
  fileIds: string[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [announcement, setAnnouncement] = useState('');
  const queue = useRef<Upload[]>([]);
  const active = useRef(0);
  const requests = useRef(new Map<string, XMLHttpRequest>());

  const update = (key: string, patch: Partial<Upload>) =>
    setUploads((current) =>
      current.map((upload) =>
        upload.key === key ? { ...upload, ...patch } : upload,
      ),
    );

  const finish = (upload: Upload, patch: Partial<Upload>) => {
    requests.current.delete(upload.key);
    active.current -= 1;
    update(upload.key, patch);
    setAnnouncement(announcementOf(upload.file.name, patch));
    if (
      patch.status === UploadStatus.Done ||
      patch.status === UploadStatus.Unconfirmed
    )
      startTransition(() => router.refresh());
    startNext();
  };

  const send = (upload: Upload) => {
    active.current += 1;
    update(upload.key, { status: UploadStatus.Uploading });

    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/meetings/${encodeURIComponent(meetingId)}/files`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.setRequestHeader('X-File-Name', encodeURIComponent(upload.file.name));
    xhr.responseType = 'json';
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable) return;
      update(upload.key, {
        progress: Math.floor((event.loaded / event.total) * 100),
      });
    };
    let bodySent = false;
    xhr.upload.onload = () => {
      bodySent = true;
      update(upload.key, { status: UploadStatus.Saving, progress: 100 });
    };
    xhr.onload = () => {
      const body = xhr.response as { id?: unknown; message?: unknown } | null;
      if (xhr.status === 201 && typeof body?.id === 'string') {
        finish(upload, { status: UploadStatus.Done, fileId: body.id });
      } else {
        finish(upload, {
          status: UploadStatus.Error,
          reason: uploadErrorOf(xhr.status, body?.message),
        });
      }
    };
    xhr.onerror = () =>
      finish(
        upload,
        bodySent
          ? {
              status: UploadStatus.Unconfirmed,
              reason: 'Связь прервалась после отправки, файл мог сохраниться',
            }
          : { status: UploadStatus.Error, reason: uploadErrorOf(0) },
      );
    xhr.onabort = () => finish(upload, { status: UploadStatus.Cancelled });
    requests.current.set(upload.key, xhr);
    xhr.send(upload.file);
  };

  const startNext = () => {
    while (active.current < MAX_PARALLEL_UPLOADS && queue.current.length > 0) {
      send(queue.current.shift()!);
    }
  };

  const enqueue = (queued: Upload[]) => {
    queue.current.push(...queued);
    startNext();
  };

  const addFiles = (files: File[]) => {
    if (files.length === 0) return;
    const added = files.map((file): Upload => {
      const reason = rejectionOf(file) ?? undefined;
      return {
        key: crypto.randomUUID(),
        file,
        status: reason ? UploadStatus.Rejected : UploadStatus.Queued,
        progress: 0,
        reason,
      };
    });
    setUploads((current) => [...added, ...current]);
    const rejected = added.filter(
      (upload) => upload.status === UploadStatus.Rejected,
    );
    if (rejected.length > 0) {
      setAnnouncement(
        rejected
          .map((upload) => announcementOf(upload.file.name, upload))
          .join('. '),
      );
    }
    enqueue(added.filter((upload) => upload.status === UploadStatus.Queued));
  };

  const cancel = (upload: Upload) => {
    const xhr = requests.current.get(upload.key);
    if (xhr) {
      xhr.abort();
      return;
    }
    queue.current = queue.current.filter((queued) => queued.key !== upload.key);
    const patch = { status: UploadStatus.Cancelled };
    update(upload.key, patch);
    setAnnouncement(announcementOf(upload.file.name, patch));
  };

  const retry = (upload: Upload) => {
    const patch = {
      status: UploadStatus.Queued,
      progress: 0,
      reason: undefined,
    };
    update(upload.key, patch);
    enqueue([{ ...upload, ...patch }]);
  };

  const onDrop: DropZoneProps['onDrop'] = async (event) => {
    const files = await Promise.all(
      event.items.flatMap((item) =>
        item.kind === 'file' ? [item.getFile()] : [],
      ),
    );
    addFiles(files);
  };

  const visible = uploads.filter(
    (upload) => !upload.fileId || !fileIds.includes(upload.fileId),
  );

  return (
    <>
      <DropZone
        className="mt-4 flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-muted/50 bg-surface px-6 py-8 text-center transition-colors data-[drop-target]:border-accent data-[drop-target]:bg-accent-soft data-[focus-visible]:outline-2 data-[focus-visible]:outline-offset-2 data-[focus-visible]:outline-focus motion-reduce:transition-none"
        aria-label="Область загрузки файлов"
        data-testid="file-drop-zone"
        onDrop={onDrop}
      >
        <span className="grid size-12 place-items-center rounded-2xl bg-accent-soft text-accent-soft-foreground">
          <ArrowUpFromLine aria-hidden="true" className="size-6" />
        </span>
        <Text className="font-medium" slot="label">
          Перетащите файлы сюда
        </Text>
        <span className="text-sm text-muted">или</span>
        <FileTrigger
          allowsMultiple
          onSelect={(list) => addFiles(list ? Array.from(list) : [])}
        >
          <Button size="lg" variant="secondary">
            Выбрать файлы
          </Button>
        </FileTrigger>
        <p className="max-w-md text-sm text-muted">
          {FILE_FORMATS.join(', ')} — до 1 ГБ
        </p>
      </DropZone>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {visible.length > 0 && (
        <Card className="mt-4 gap-0 p-0">
          <ul aria-label="Загрузки" className="divide-y divide-separator">
            {visible.map((upload) => (
              <UploadRow
                key={upload.key}
                upload={upload}
                onCancel={() => cancel(upload)}
                onRetry={() => retry(upload)}
              />
            ))}
          </ul>
        </Card>
      )}

      {children}
    </>
  );
}

const CANCELLABLE = [UploadStatus.Queued, UploadStatus.Uploading];
const RETRYABLE = [UploadStatus.Error, UploadStatus.Cancelled];

function UploadRow({
  upload,
  onCancel,
  onRetry,
}: {
  upload: Upload;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const { file, status, progress, reason } = upload;
  const action = CANCELLABLE.includes(status)
    ? {
        label: 'Отменить',
        name: `Отменить загрузку ${file.name}`,
        Icon: Xmark,
        onPress: onCancel,
      }
    : RETRYABLE.includes(status)
      ? {
          label: 'Повторить',
          name: `Повторить загрузку ${file.name}`,
          Icon: ArrowRotateRight,
          onPress: onRetry,
        }
      : null;

  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-6">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-foreground">
        <FileIcon aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <p className="min-w-0 font-medium wrap-anywhere">{file.name}</p>
          <span className="shrink-0 text-sm text-muted tabular-nums">
            {formatFileSize(file.size)}
          </span>
        </div>
        {status === UploadStatus.Uploading || status === UploadStatus.Saving ? (
          <ProgressBar
            aria-label={`Загрузка ${file.name}`}
            className="mt-2"
            size="sm"
            value={progress}
          >
            <ProgressBar.Output className="text-muted" />
            <ProgressBar.Track>
              <ProgressBar.Fill />
            </ProgressBar.Track>
          </ProgressBar>
        ) : (
          <StatusLine reason={reason} status={status} />
        )}
        {status === UploadStatus.Saving && (
          <p className="mt-1 text-sm text-muted">Сохраняем…</p>
        )}
      </div>
      {action && (
        <Button
          aria-label={action.name}
          className="shrink-0 max-sm:size-11 max-sm:px-0"
          size="sm"
          variant="secondary"
          onPress={action.onPress}
        >
          <action.Icon aria-hidden="true" className="size-4" />
          <span className="max-sm:sr-only">{action.label}</span>
        </Button>
      )}
    </li>
  );
}

function StatusLine({
  status,
  reason,
}: {
  status: UploadStatus;
  reason?: string;
}) {
  if (status === UploadStatus.Queued) {
    return <p className="mt-1 text-sm text-muted">В очереди</p>;
  }
  if (status === UploadStatus.Done) {
    return (
      <p className="mt-1 flex items-center gap-1.5 text-sm text-success">
        <CircleCheck aria-hidden="true" className="size-4 shrink-0" />
        Загружен
      </p>
    );
  }
  if (status === UploadStatus.Cancelled) {
    return <p className="mt-1 text-sm text-muted">Загрузка отменена</p>;
  }
  return (
    <p className="mt-1 flex items-center gap-1.5 text-sm text-danger-soft-foreground">
      <CircleExclamation aria-hidden="true" className="size-4 shrink-0" />
      {reason ?? 'Не удалось загрузить'}
    </p>
  );
}
