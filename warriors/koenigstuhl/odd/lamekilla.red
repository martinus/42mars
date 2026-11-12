;redcode-94
;name lame killa
;author philipp stefan
;strategy find+stun CIA then jmz-scan
;assert 1
; KOFACOTO 4

scan      dat    #100, #4000

loc       dat    $0, $-10
loc2      dat    $-1390, $-1390
boot      jmz    boot, <loc
          add    @loc, loc2
          add    loc2, loc
          mov    stun, <loc
          djn    -1, #20
          sub    loc2, loc
          add.ab loc2, loc
          mov    stun, <loc
          djn    -1, #20
          jmp    start
stun      spl    #0, #0

attack    mov.i     split, >scan
          jmn.f     attack, @scan
start     sub       inc, scan
          jmn.f     check, @scan
          jmz.f     start, *scan
          mov.x     scan, scan
check     slt       scan, #24
inc       jmp       attack, #-7
          djn       start, #40
change    jmp       start, }attack
split     spl       #666, #999

end       boot

