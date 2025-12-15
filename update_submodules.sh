#!/bin/bash

git submodule update --init --recursive

git submodule foreach '
  git checkout main || git checkout master
  git pull
'