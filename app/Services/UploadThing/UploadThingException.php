<?php

namespace App\Services\UploadThing;

use RuntimeException;

class UploadThingException extends RuntimeException
{
    public function __construct(string $message, public readonly int $status = 500)
    {
        parent::__construct($message);
    }
}
