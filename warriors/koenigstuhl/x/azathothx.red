;redcode-94x
;name Azathoth
;author John Metcalf
;strategy paper/stone, sleeping chaos
;assert CORESIZE==55440

        sboot  equ warr-5770
        pboot  equ warr+6172

warr    spl    2,        {45874
        spl    1,        {24659
        spl    1,        {18048
        mov    <p,       {p
        mov    <stone-1, {s
s       spl    sboot,    {33099
        spl    *s,       {17016
        spl    *s,       {21977
        spl    *s,       {49766
        spl    *s,       {38654
p       djn.f  pboot,    {paper+6

        sstep  equ 23431
        time   equ 10230
        first  equ (hit+ptr+sstep*time)

        spl    #0,         6
stone   mov    bomb,       @ptr
hit     sub.x  #sstep*2,   @stone
ptr     mov    {-23878,    }first
        djn.f  @hit,       }ptr
bomb    dat    <sstep,     >1

        pstep  equ 16342

paper   spl    pstep,      {x
        mov    }x,         }paper
        mov    }x+3,       }paper
x       mov    {x+3,       }paper
        jmz.f  @x-1,       *x

