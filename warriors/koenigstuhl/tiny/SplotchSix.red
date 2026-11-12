;redcode-tiny
;assert CORESIZE == 800
;name rdrc: Splotch Six
;author Dave Hillis
;strategy -  Created using RedRace.c.
;strategy -  An evolving population playing KOTH.
;strategy -  Configured for the Tiny hill.
; 6/1/15 A clear that morphs into a paper.
; Starts with core-clear and djn-stream.
; The core-clear also copies the warrior.
; After the djn hits itself, the warrior starts
; splitting into core and, eventually, the copies.
spl.ba $    6, <    -6
spl.ba {  -202, <  -118
mov.i  <    27, <    -9
djn.ba $    -1, >    5
end  1

