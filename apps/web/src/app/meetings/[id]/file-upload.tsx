'use client';

import ArrowUpFromLine from '@gravity-ui/icons/ArrowUpFromLine';
import CircleCheck from '@gravity-ui/icons/CircleCheck';
import CircleExclamation from '@gravity-ui/icons/CircleExclamation';
import FileIcon from '@gravity-ui/icons/File';
import { Button, Card, ProgressBar } from '@heroui/react';
import { useRouter } from 'next/navigation';
import { useRef, useState, useTransition, type ReactNode } from 'react';
import {
  DropZone,
  Text,
  type DropZoneProps,
} from 'react-aria-components/DropZone';
import { FileTrigger } from 'react-aria-components/FileTrigger';
import { formatFileSize } from '@/lib/file-size';

const MAX_PARALLEL_UPLOADS = 3;

enum UploadStatus {
  Queued = 'queued',
  Uploading = 'uploading',
  Saving = 'saving',
  Done = 'done',
  Error = 'error',
}

type Upload = {
  key: string;
  file: File;
  status: UploadStatus;
  progress: number;
  fileId?: string;
};

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

  const update = (key: string, patch: Partial<Upload>) =>
    setUploads((current) =>
      current.map((upload) =>
        upload.key === key ? { ...upload, ...patch } : upload,
      ),
    );

  const finish = (upload: Upload, patch: Partial<Upload>) => {
    active.current -= 1;
    update(upload.key, patch);
    setAnnouncement(
      patch.status === UploadStatus.Done
        ? `Файл «${upload.file.name}» загружен`
        : `Не удалось загрузить «${upload.file.name}»`,
    );
    if (patch.status === UploadStatus.Done)
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
    xhr.upload.onload = () =>
      update(upload.key, { status: UploadStatus.Saving, progress: 100 });
    xhr.onload = () => {
      const body = xhr.response as { id?: unknown } | null;
      if (xhr.status === 201 && typeof body?.id === 'string') {
        finish(upload, { status: UploadStatus.Done, fileId: body.id });
      } else {
        finish(upload, { status: UploadStatus.Error });
      }
    };
    xhr.onerror = () => finish(upload, { status: UploadStatus.Error });
    xhr.send(upload.file);
  };

  const startNext = () => {
    while (active.current < MAX_PARALLEL_UPLOADS && queue.current.length > 0) {
      send(queue.current.shift()!);
    }
  };

  const addFiles = (files: File[]) => {
    if (files.length === 0) return;
    const added = files.map((file) => ({
      key: crypto.randomUUID(),
      file,
      status: UploadStatus.Queued,
      progress: 0,
    }));
    setUploads((current) => [...added, ...current]);
    queue.current.push(...added);
    startNext();
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
      </DropZone>

      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>

      {visible.length > 0 && (
        <Card className="mt-4 gap-0 p-0">
          <ul aria-label="Загрузки" className="divide-y divide-separator">
            {visible.map((upload) => (
              <UploadRow key={upload.key} upload={upload} />
            ))}
          </ul>
        </Card>
      )}

      {children}
    </>
  );
}

function UploadRow({ upload }: { upload: Upload }) {
  const { file, status, progress } = upload;

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
          <StatusLine status={status} />
        )}
        {status === UploadStatus.Saving && (
          <p className="mt-1 text-sm text-muted">Сохраняем…</p>
        )}
      </div>
    </li>
  );
}

function StatusLine({ status }: { status: UploadStatus }) {
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
  return (
    <p className="mt-1 flex items-center gap-1.5 text-sm text-danger">
      <CircleExclamation aria-hidden="true" className="size-4 shrink-0" />
      Не удалось загрузить
    </p>
  );
}
