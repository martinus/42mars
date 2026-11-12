;redcode-tiny
;name Kosmos
;author John Metcalf
;strategy quickbomb -> paper with satellite
;assert 1

        dpos   equ decoy+492
        dgap   equ 385
        dst    equ 578

decoy   a for  9
        mov    {dpos+dgap+dst*a,dpos+dst*a
        rof

        step   equ 33*4
        dist   equ 46*4

        spl    1,        {600
        spl    1,        {400

        mov    }clear+1, >launch

paper   spl    step
        mov    >paper,   }paper
        mov    <launch,  {launch
launch  djn.f  step+dist,{dist-4

satel   spl    #167,     <-146
clear   mov    1,        <1
        mov    <0-2,     <375
        djn.f  satel,    <satel-146

        end

