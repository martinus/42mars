;redcode
;name RLE-1
;author Roy
;assert 1

encodeLocation equ 100
decodeLocation equ 200

start
; Encode to >100
encode
rptre  mov.b toEncode, start+encodeLocation
      add.a #3, -1
      add.a #1,@-2
      seq.b *rptre, @rptre
      add.ab #3,rptre

gptre  mov.b toEncode+1, start+encodeLocation+1
      add.a #3, -1
      add.a #1,@-2
      seq.b *gptre, @gptre
      add.ab #3,gptre

bptre  mov.b toEncode+2, start+encodeLocation+2
      add.a #3, -1
      add.a #1,@-2
      seq.b *bptre, @bptre
      add.ab #3,bptre

      jmn.b encode, *rptre

; Start decode, place results in >200
decode
loop
      mov.b @1, >decodeTo
rptr   jmn.a 2, {start+encodeLocation
      add.ab #3, -1
      mov.b @1, >decodeTo
gptr   jmn.a 2, {start+encodeLocation+1
      add.ab #3, -1
      mov.b @1, >decodeTo
bptr   jmn.a 2, {start+encodeLocation+2
      add.ab #3, -1

      seq.f empty, @rptr
      jmp loop
      seq.f empty, @gptr
      jmp loop
      seq.f empty, @bptr
      jmp loop

; Done!
empty      dat 0,0
decodeTo   dat 0,start+decodeLocation

; Here is the RGB stream:
toEncode
    dat 0,5 ;R
    dat 0,4 ;G
    dat 0,7 ;B
    dat 0,5 ;R
    dat 0,6 ;etc...
    dat 0,9
    dat 0,4
    dat 0,6
    dat 0,9
    dat 0,1
    dat 0,6
    dat 0,9
    dat 0,1
    dat 0,6
    dat 0,3
    dat 0,7
    dat 0,7
    dat 0,3


; This is what the RLE encoded stream should look like (at 100)
; (like described in the previous post, minus the errors :-))
;
;     dat 2,5
;     dat 1,4
;     dat 1,7
;     dat 1,4
;     dat 4,6
;     dat 3,9
;     dat 2,1
;     dat 1,7
;     dat 2,3
;     dat 1,7
;     dat 0
;     dat 0
;
; And the decoded stream will be placed at 200, should be the same as
; above.

	end start

