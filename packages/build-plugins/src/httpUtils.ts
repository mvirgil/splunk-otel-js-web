/*
Copyright 2025 Splunk Inc.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import axios from 'axios';
import { createReadStream, statSync } from 'fs';

const FormData = require('form-data');

interface FileUpload {
  filePath: string;
  fieldName: string;
}

interface UploadOptions {
  url: string;
  file: FileUpload;
  method?: 'PUT' | 'POST';
  parameters: { [key: string]: string | number };
  onProgress?: (progressInfo: { progress: number; loaded: number; total: number }) => void;
}

export interface ProgressInfo {
  progress: number;
  loaded: number;
  total: number;
}

// This uploadFile method will be used by all the different commands that want to upload various types of
// symbolication files to o11y cloud. The url, file, and additional parameters are to be prepared by the
// calling method. Various errors, Error, axiosErrors and all should be handled by the caller of this method.
// Since the API contracts with the backend are not yet determined. This is subject to change

export const uploadFile = async ({ url, file, parameters, onProgress }: UploadOptions): Promise<void> => {
  const formData = new FormData();

  formData.append(file.fieldName, createReadStream(file.filePath));

  for (const [ key, value ] of Object.entries(parameters)) {
    formData.append(key, value);
  }

  const fileSizeInBytes = statSync(file.filePath).size;

  await axios.put(url, formData, {
    headers: {
      'x-sf-orgid': 'AAAAAAAB4kA',
      ...formData.getHeaders(),
    },
    onUploadProgress: (progressEvent) => {
      const loaded = progressEvent.loaded;
      const total = progressEvent.total || fileSizeInBytes;
      const progress = (loaded / total) * 100;
      if (onProgress) {
        onProgress({ progress, loaded, total });
      }
    },
  });
};

export const mockUploadFile = async ({ file, onProgress }: UploadOptions): Promise<void> => {
  const fileSizeInBytes = statSync(file.filePath).size;

  return new Promise((resolve) => {
    const mbps = 25;
    const bytes_to_megabits = (bytes: number) => bytes * 8 / 1000 / 1000;

    // simulate axios progress events
    const tick = 50;
    let msElapsed = 0;
    const intervalId = setInterval(() => {
      msElapsed += tick;
      const loaded = Math.floor((msElapsed / 1000) * mbps / 8 * 1024 * 1024);
      const total = fileSizeInBytes;
      const progress = (loaded / total) * 100;
      onProgress?.({ loaded, total, progress });
    }, tick);

    // simulate axios completion
    setTimeout(() => {
      clearInterval(intervalId);
      resolve();
    }, bytes_to_megabits(fileSizeInBytes) / mbps * 1000);
  });
};
