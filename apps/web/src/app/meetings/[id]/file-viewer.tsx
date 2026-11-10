'use client';

import Eye from '@gravity-ui/icons/Eye';
import { Alert, Button, buttonVariants, Modal } from '@heroui/react';
import Image from 'next/image';
import { useState } from 'react';
import { ViewKind } from '@/lib/file-rules';

type MediaKind = ViewKind.Video | ViewKind.Audio | ViewKind.Image;

type FileViewerProps = {
  name: string;
  kind: MediaKind;
  viewUrl: string;
  downloadUrl: string;
};

export function FileViewer(props: FileViewerProps) {
  return (
    <Modal>
      <Button
        aria-label={`Смотреть ${props.name}`}
        className="shrink-0 max-sm:size-11 max-sm:px-0"
        size="sm"
        variant="secondary"
      >
        <Eye aria-hidden="true" className="size-4" />
        <span className="max-sm:sr-only">Смотреть</span>
      </Button>
      <Modal.Backdrop>
        <Modal.Container size="lg">
          <Modal.Dialog
            className={
              props.kind === ViewKind.Audio ? undefined : 'sm:max-w-3xl'
            }
          >
            <Modal.CloseTrigger aria-label="Закрыть" />
            <Modal.Header>
              <Modal.Heading className="pr-8 wrap-anywhere">
                {props.name}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body>
              <Viewer {...props} />
            </Modal.Body>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function Viewer({ name, kind, viewUrl, downloadUrl }: FileViewerProps) {
  const [failed, setFailed] = useState(false);
  const fail = () => setFailed(true);

  if (failed) {
    return (
      <Alert role="alert" status="danger">
        <Alert.Indicator />
        <Alert.Content>
          <Alert.Title>Браузер не может открыть этот файл</Alert.Title>
          <Alert.Description>
            Формат или кодек не поддерживается. Скачайте файл и откройте его в
            программе на устройстве.
          </Alert.Description>
          <a
            className={buttonVariants({
              className: 'mt-3 max-sm:h-11',
              size: 'sm',
              variant: 'secondary',
            })}
            href={downloadUrl}
          >
            Скачать
          </a>
        </Alert.Content>
      </Alert>
    );
  }

  switch (kind) {
    case ViewKind.Video:
      return (
        <video
          className="max-h-[70dvh] w-full rounded-lg bg-black"
          controls
          onError={fail}
          playsInline
          preload="metadata"
          src={viewUrl}
        />
      );
    case ViewKind.Audio:
      return (
        <audio
          className="w-full"
          controls
          onError={fail}
          preload="metadata"
          src={viewUrl}
        />
      );
    case ViewKind.Image:
      return (
        <Image
          alt={name}
          className="mx-auto h-auto max-h-[70dvh] w-auto max-w-full rounded-lg"
          height={0}
          onError={fail}
          src={viewUrl}
          unoptimized
          width={0}
        />
      );
  }
}
