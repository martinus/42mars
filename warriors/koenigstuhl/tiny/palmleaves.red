;redcode-tiny
;name palm leaves
;author Metcalf/Schmidt
;strategy silk, stone and imps
;assert CORESIZE==800

istep   equ     267
pstep   equ     219
sstep   equ     239

top     mov     <g2,            {g2
g2      spl     silk+5+istep,   imp+1

silk    spl     pstep,          0
stone   mov.i   >silk,          }silk
        spl     {0,             }0
        add.x   #sstep,         stone
imp     mov.i   #1,             istep

        for     7
        dat     0,              0
        rof

start   spl     2,              {silk-170
        spl     2,              {silk-istep-170
        spl     1,              {silk+istep-170

        spl     top,            {silk+sstep-170
        mov     <g1,            {g1
g1      djn     silk+5-istep,   #imp+1

        end     start

