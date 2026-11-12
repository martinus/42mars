;redcode-94x
;name Despair X
;author John Metcalf
;strategy paper/stone
;assert CORESIZE==55440

        org    despair

        spos   equ (despair+19310)
        ppos   equ (spos+3009)

sbmb    dat    <step,      >1

despair mov    sbmb,     spos+2
        spl    2,        <500
        spl    1,        <1000
        spl    1,        <1500

        mov    {boot,    {sboot
sboot   spl    spos,     <2000
        spl    *sboot,   <2500
        spl    *sboot,   <3000
        spl    *sboot,   <3500
        mov    {boot,    {pboot
pboot   djn.f  ppos,     <4000

        pstep  equ 51294

paper   spl    pstep,    {psrc
        mov    }psrc,    }paper
        mov    pbmb,     >32890
psrc    mov    }paper+6, }paper
        djn.f  @psrc,    <17552
pbmb    dat    >1,       >27721

        step   equ 8807
        time   equ 12696
        first  equ (last+step*time)

boot    spl    #6,       0
stone   mov    7,        @ptr
last    sub.x  #step*2,  @stone
ptr     mov    {13376,   }first
        djn.f  @last,    }ptr

        end

