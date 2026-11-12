
;redcode-94nop
;name hawk 82
;author John Metcalf
;strategy try to tie
;strategy IRCT18 Entry
;assert CORESIZE==8000


top  mov   <g2,            {g2
g2   spl   pap1+8+istep,   imp+1

pap1:spl   @0,       <pstep1
     mov.i }pap1,    >pap1
pap2:spl   pstep2,   {pap1
     mov.i }pap1,    }pap2
     spl   {0,       }0
     add.x #sstep,   -2
     spl   -2
imp: mov.i #1,       istep

     for 23
     dat 0,0
     rof

     pstep1 equ 3005
     pstep2 equ 1525
     sstep equ 127
     istep equ 2667

less:spl pStart,<1000
     spl   1,<2000
     spl   1,<3000
     spl   1,<4000

     spl   top,<5000

     mov     <g1,            {g1
g1:  djn     pap1+8-istep,   #imp+1

for 50
dat 0,0
rof

iStep   equ     3077
pStep   equ     3497
sStep   equ     6495
first   equ     -12

pStart  spl     1,              <6000
        spl     1,              <7000
        mov.i   {0,             #0
pap1a:   spl     @0,             }pStep
        mov.i   }pap1a,          >pap1a
        spl     @1,             {2000
        spl     #0,             0
        add.x   imp2,            ptr
ptr:    djn.f   imp2-(iStep*14), <first
imp2:    mov.i   #sStep,         iStep

end less
