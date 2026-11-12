;redcode-94
;name blue killa
;author philipp stefan
;strategy scanner
;assert 1
; KOFACOTO-1


scan      dat       #100, #4000
attack    mov.i     split, >scan
          jmn.f     attack, @scan
start     sub       inc, scan
          jmn.f     check, @scan
          jmz.f     start, *scan
          mov.x     scan, scan
check     slt       scan, #12
inc       jmp       attack, #-7
          djn       start, #25
change    jmp       start, }attack
split     spl       #666, #999

end       start

