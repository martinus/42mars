;redcode-94x
;name Lard IRC10
;author Philip Thorne
;strategy Parallel stones, staggered djn for anti-dclear
;assert 1

DOFF    EQU     stone-200
STEP    EQU     316
STEP2   EQU     206
MOFF    EQU     STEP
MOFF2   EQU     STEP2
dptr    EQU     stone+200

        nop     }0
stone:  spl     0,      >dptr
        mod.x   >dptr,  @MOFF
        add.ab  #STEP,  -1
        djn.f   @-1,    <DOFF
        jmp     -1

    for 6
        dat     0,      0
    rof

        nop     }0
st2:    spl     0,      >dptr
        mod.x   >dptr,  @MOFF2
        add.ab  #STEP2, -1
        djn.f   @-1,    <DOFF
        jmp     -1

start:  spl     stone
        jmp     st2
