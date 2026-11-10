import ArrowDownToLine from '@gravity-ui/icons/ArrowDownToLine';
import Eye from '@gravity-ui/icons/Eye';
import File from '@gravity-ui/icons/File';
import { Alert, buttonVariants, Card, Skeleton } from '@heroui/react';
import { MeetingDate } from '@/app/meeting-date';
import { RetryButton } from '@/app/retry-button';
import { filePath } from '@/lib/file-proxy';
import { ViewKind, viewKindOf } from '@/lib/file-rules';
import { formatFileSize } from '@/lib/file-size';
import { getMeetingFiles, type MeetingFile } from '@/lib/meeting-files';
import { DeleteFileButton } from './delete-file-button';
import { FileUpload } from './file-upload';
import { FileViewer } from './file-viewer';

const actionClassName = buttonVariants({
  className: 'shrink-0 max-sm:size-11 max-sm:px-0',
  size: 'sm',
  variant: 'secondary',
});

export async function MeetingFiles({ meetingId }: { meetingId: string }) {
  const files = await getMeetingFiles(meetingId);

  return (
    <section aria-labelledby="files" className="mt-10">
      <h2
        className="text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-focus"
        id="files"
        tabIndex={-1}
      >
        Файлы
        {files && (
          <>
            {' '}
            <span className="font-normal text-muted">({files.length})</span>
          </>
        )}
      </h2>
      {!files ? (
        <LoadError />
      ) : (
        <FileUpload
          fileIds={files.map((file) => file.id)}
          meetingId={meetingId}
        >
          {files.length === 0 ? (
            <Card className="mt-4 px-6 py-8 text-center text-muted">
              Файлов пока нет
            </Card>
          ) : (
            <Card className="mt-4 gap-0 p-0">
              <ul aria-labelledby="files" className="divide-y divide-separator">
                {files.map((file) => (
                  <FileRow key={file.id} file={file} meetingId={meetingId} />
                ))}
              </ul>
            </Card>
          )}
        </FileUpload>
      )}
    </section>
  );
}

function FileRow({
  file,
  meetingId,
}: {
  file: MeetingFile;
  meetingId: string;
}) {
  const downloadUrl = filePath(meetingId, file.id);
  const viewUrl = `${downloadUrl}/view`;
  const viewKind = viewKindOf(file.mimeType);

  return (
    <li className="flex items-center gap-3 px-4 py-3 sm:px-6">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-foreground max-sm:hidden">
        <File aria-hidden="true" className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium wrap-anywhere">{file.name}</p>
        <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted">
          <span className="tabular-nums">{formatFileSize(file.size)}</span>
          <span className="whitespace-nowrap">
            <MeetingDate iso={file.createdAt} />
          </span>
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {viewKind === ViewKind.Pdf ? (
          <a
            aria-label={`Смотреть ${file.name}`}
            className={actionClassName}
            href={viewUrl}
            rel="noopener"
            target="_blank"
          >
            <Eye aria-hidden="true" className="size-4" />
            <span className="max-sm:sr-only">Смотреть</span>
          </a>
        ) : (
          viewKind && (
            <FileViewer
              downloadUrl={downloadUrl}
              kind={viewKind}
              name={file.name}
              viewUrl={viewUrl}
            />
          )
        )}
        <a
          aria-label={`Скачать ${file.name}`}
          className={actionClassName}
          href={downloadUrl}
        >
          <ArrowDownToLine aria-hidden="true" className="size-4" />
          <span className="max-sm:sr-only">Скачать</span>
        </a>
        <DeleteFileButton
          fileId={file.id}
          meetingId={meetingId}
          name={file.name}
        />
      </div>
    </li>
  );
}

function LoadError() {
  return (
    <Alert className="mt-4" role="alert" status="danger">
      <Alert.Indicator />
      <Alert.Content>
        <Alert.Title>Не удалось загрузить файлы</Alert.Title>
        <Alert.Description>
          Сервер не ответил. Попробуйте ещё раз, а если ошибка повторяется,
          выйдите и войдите снова.
        </Alert.Description>
        <RetryButton />
      </Alert.Content>
    </Alert>
  );
}

export function MeetingFilesSkeleton() {
  return (
    <div role="status">
      <span className="sr-only">Загружаем файлы…</span>
      <div
        aria-hidden="true"
        className="motion-reduce:[&_.skeleton::after]:animate-none"
      >
        <MeetingFilesPlaceholder />
      </div>
    </div>
  );
}

export function MeetingFilesPlaceholder() {
  return (
    <>
      <Skeleton className="mt-10 h-7 w-32 rounded-md" />
      <Card className="mt-4 gap-0 p-0">
        <div className="divide-y divide-separator">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="flex items-center gap-3 px-4 py-3 sm:px-6"
            >
              <Skeleton className="size-10 shrink-0 rounded-xl max-sm:hidden" />
              <div className="flex min-w-0 flex-1 flex-col gap-2.5">
                <Skeleton className="h-5 w-3/5 rounded-md" />
                <Skeleton className="h-4 w-2/5 rounded-md" />
              </div>
              <div className="flex shrink-0 gap-2">
                <Skeleton className="size-11 rounded-full sm:h-9 sm:w-27.5 md:h-8" />
                <Skeleton className="size-11 rounded-full sm:h-9 sm:w-25 md:h-8" />
                <Skeleton className="size-11 rounded-full sm:size-9 md:size-8" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
