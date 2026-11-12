;redcode-tiny
;name Wraith
;author John Metcalf
;strategy decoy maker -> TNT bomber -> SPL/DAT clear
;assert 1 || CORESIZE==800

        dpos   equ decoy+204

        org    decoy

        time   equ 89
        step   equ 195

tntbomb mov    step,       1

wraith  mov    tntbomb,    @ptr
ptr     mov    tntbomb,    {2+time*(step*2-1)
gate    add    #1-step*2,  ptr
        djn    wraith,     #time

bptr    div.ba #9,         #1
bomb    spl    #8,         30
clear   mov    @bptr,      }gate
        djn.f  clear,      >bomb

        for    3
        dat    0,0
        rof

decoy   mov    >dpos+1,    {dpos+22
        mov    <dpos+23,   {dpos+43
        mov    <dpos+44,   {dpos+64
        mov    <dpos+65,   {dpos+85
        mov    <dpos+86,   {dpos+107
        mov    <dpos+108,  {dpos+128
        mov    <dpos+129,  {dpos+149
        djn.f  wraith,     <dpos+170

        end



