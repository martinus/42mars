;redcode
;name Thirty Second
;author PBT
;strategy Fizmo's Redcoder Frenzy [Limited-Distance] Entry #1/1
;strategy   hopper/clear with paper backup.
;strategy
;strategy   This round had interesting/appealing rules but I've
;strategy   been short of time so sadly submit this 1/2minute [*]
;strategy   effort as some points are better than none [I missed 
;stratgey   the last round].
;strategy
;strategy   Doesn't do well vs ancient warrior benchmark :(
;strategy   [*] not really. :)
;assert CORESIZE%800 == 0

hStep   EQU     (-381)
hBomb   EQU     (hStep/2)


;hopper chaotic clear [?]
weap:   dat     #0,         #hStep
keep:   mov.i   }-1,        >-1
leap:   spl     hStep-1,    <hBomb
        djn.f   -2,         <-400

    for 70
        dat     0,          0
    rof

;backup [poor paper, bad spread]
paper:  spl     1
        spl     1
pap1:   spl     @0,         <383
        mov.i   }pap1,      >pap1
        mov.i   {pap1,      <pap2
pap2:   jmz.a   @0,         717

    for 10
        dat     0,          0
    rof

proc:   spl     1,          1
        spl     1,          1
        spl     keep,       >399
        mod.f   #1,          #1
wait:   djn.b   #1,         <37
        jmp     paper,      1

    end proc