;redcode-94x
;name Barrage AX 11
;author Steve Gunnell
;strategy Dawn assult!
;assert 1

STEP   equ 11091
TIME   equ 32725
STOP   equ (bGo - gate - 4 - 0 )
GAP1   equ 48
IMPNUM  equ 38 

        dat $0, $0
bGo     spl     # 1,          1
loop    mov.i     bGo,      > gate
    for 4
        mov.i   * loop,     > gate
    rof
        mod.ab  # STOP,       gate
        add.ab  # STEP,     @ -1
        djn.b     loop,     # TIME
        dat     { loop,       0
    for GAP1
        dat.f   $ 0,        $ 0
    rof
gate    dat     # 0,        # 11986

end bGo

