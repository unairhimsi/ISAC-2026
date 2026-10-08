<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\UploadThing\UploadThingException;
use App\Services\UploadThing\UploadThingSigner;
use App\Services\UploadThing\UploadThingToken;
use App\Services\UploadThing\UploadThingUploadService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class UploadThingController extends Controller
{
    public function __construct(
        private readonly UploadThingUploadService $uploads,
        private readonly UploadThingSigner $signer,
    ) {}

    public function config(): JsonResponse
    {
        return response()->json($this->uploads->routeConfig());
    }

    public function upload(Request $request): JsonResponse
    {
        try {
            if ($request->query('actionType') !== 'upload') {
                return $this->nothing();
            }

            return response()->json($this->uploads->prepare(
                $request->user(),
                (string) $request->query('slug'),
                $request->all(),
                (string) $request->header('x-uploadthing-package', 'unknown'),
            ));
        } catch (UploadThingException $e) {
            return $this->failure($e, 'upload');
        }
    }

    public function hook(Request $request): JsonResponse
    {
        $started = microtime(true);

        try {
            $token = UploadThingToken::fromConfig();
            $body = $request->getContent();

            if (! $this->signer->verify($body, $request->header('x-uploadthing-signature'), $token->apiKey)) {
                throw new UploadThingException('Invalid signature', 400);
            }

            $payload = json_decode($body, true);
            $hook = $request->header('uploadthing-hook');

            if ($hook === 'error') {
                Log::warning('UploadThing melaporkan upload gagal', ['payload' => is_array($payload) ? $payload : null]);
            } elseif ($hook === 'callback' && is_array($payload)) {
                $this->uploads->complete((string) $request->query('slug'), $payload);
            }

            return $this->nothing();
        } catch (UploadThingException $e) {
            return $this->failure($e, 'hook');
        } finally {
            $seconds = microtime(true) - $started;

            if ($seconds > 5) {
                Log::warning('UploadThing hook lambat diproses', ['detik' => round($seconds, 1)]);
            }
        }
    }

    private function nothing(): JsonResponse
    {
        return new JsonResponse('null', 200, [], 0, true);
    }

    private function failure(UploadThingException $e, string $stage): JsonResponse
    {
        Log::log($e->status >= 500 ? 'error' : 'warning', 'UploadThing '.$stage.' ditolak atau gagal', [
            'status' => $e->status,
            'reason' => $e->getMessage(),
        ]);

        return response()->json(['message' => $e->getMessage()], $e->status);
    }
}
