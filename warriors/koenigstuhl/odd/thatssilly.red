;redcode
;name That's silly
;author Lukasz Adamowski
; It was my entry to the 13th IRC Tournament. It won then. :]
; The only difference is it was 2520 core, oh, yeah, and multiwarrior.
;assert 1
; IRCT-27
; CORESIZE 4000
; MAXPROCESSES 8
; MAXCYCLES 4000

boot  mov start, start+CORESIZE/2+4
      FOR 5
      mov }boot, >boot
      ROF
      spl start+CORESIZE/2+4
start spl #0, -1
      mov 3, <-1
      mov 2, <-2
      jmp -3, <-3

      end boot

