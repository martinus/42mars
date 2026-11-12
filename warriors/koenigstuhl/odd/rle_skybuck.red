;redcode
;name RLE-2
;author Roy+Skybuck
;assert 1
; Roy's RLE RGB encoder/decoder.
; Partially fixed by Skybuck Flying.
; version 6 created on 20 may 2010 by Skybuck Flying
; For some reason the decoder runs out of sync with the encoder as the end.
; The pascal version does not have this problem ?!
; The encoder seems to encode properly.
; The decoder probably has a bug somewhere ?!
; or maybe even Corewin has a bug... or redcode itself... who knows ?! ;) :)

encodeLocation equ 100
decodeLocation equ 200

start
;Encode to >100

DecodePointerEnd
EncodePointerEnd nop $encodeLocation+3, $encodeLocation+3

; // problem it needs to use seperate pointer variables... otherwise the
; pointers can't be shared !?!?
; // because their offsets would need to be different ?!
; // but let's calculate that for now, that's possible ! ;) :)
encode
rptre  mov.b toEncode, start+encodeLocation
      add.a #3, -1
      add.a #1,@-2

;       seq.b *rptre, @rptre
tempr  mov.b *rptre, #tempr
      sub.b @rptre, $tempr
      jmz.b $4, $tempr
;       add.ab #3, $rptre
      mov.b $EncodePointerEnd, $rptre
      sub.ab #-(EncodePointerEnd - rptre), $rptre
      add.ab #1, $EncodePointerEnd

gptre  mov.b toEncode+1, start+encodeLocation+1
      add.a #3, -1
      add.a #1,@-2
;       seq.b *gptre, @gptre
tempg  mov.b *gptre, #tempg
      sub.b @gptre, $tempg
      jmz.b $4, $tempg
;       add.ab #3, $gptre
      mov.b $EncodePointerEnd, $gptre
      sub.ab #-(EncodePointerEnd - gptre), $gptre
      add.ab #1, $EncodePointerEnd

bptre  mov.b toEncode+2, start+encodeLocation+2
      add.a #3, -1
      add.a #1,@-2
;       seq.b *bptre, @bptre
tempb  mov.b *bptre, #tempb
      sub.b @bptre, $tempb
      jmz.b $4, $tempb
;       add.ab #3, $bptre
      mov.b $EncodePointerEnd, $bptre
      sub.ab #-(EncodePointerEnd - bptre), $bptre
      add.ab #1, $EncodePointerEnd

;       jmn.b encode, *rptre
      djn encode, #(18 / 3)

;Start decode, place results in >200
decode
loop
      mov.b @1, >decodeTo
rptr   jmn.a 4, {start+encodeLocation
;       add.ab #3, -1
      mov.ab $DecodePointerEnd, $rptr
      sub.ab #-(DecodePointerEnd - rptr), $rptr
;       sub.ab #30, $rptr
      add.a #1, $DecodePointerEnd

      mov.b @1, >decodeTo
gptr   jmn.a 4, {start+encodeLocation+1
;       add.ab #3, -1
      mov.ab $DecodePointerEnd, $gptr
      sub.ab #-(DecodePointerEnd - gptr), $gptr
;       sub.ab #35, $gptr
      add.a #1, $DecodePointerEnd

      mov.b @1, >decodeTo
bptr   jmn.a 4, {start+encodeLocation+2
;       add.ab #3, -1
      mov.ab $DecodePointerEnd, $bptr
      sub.ab #-(DecodePointerEnd - bptr), $bptr
; sub.ab #40, $bptr
      add.a #1, $DecodePointerEnd

; this now no longer works ;) probably because of bug ;) :)
;       seq.f empty, @rptr
;       jmp loop
;       seq.f empty, @gptr
;       jmp loop
;       seq.f empty, @bptr
;       jmp loop

;  replaced with much shorter solution:
 djn decode, #(18/3)

; Done!
empty      dat 0,0
decodeTo   dat 0,start+decodeLocation

; Here is the RGB stream:
toEncode
    dat 0,1 ;R
    dat 0,4 ;G
    dat 0,7 ;B
    dat 0,1 ;R
    dat 0,6 ;G
    dat 0,9 ;B
    dat 0,1 ;R
    dat 0,6 ;G
    dat 0,9 ;B
    dat 0,1 ;R
    dat 0,6 ;G
    dat 0,9 ;B
    dat 0,1 ;R
    dat 0,6 ;G
    dat 0,3 ;B
    dat 0,1 ;R
    dat 0,7 ;G
    dat 0,3 ;B

	end

