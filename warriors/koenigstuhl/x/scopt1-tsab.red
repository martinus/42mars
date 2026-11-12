;redcode-94x
;assert CORESIZE==55440
;name Scythe A 38
;author Steve Gunnell
;strategy Bit of Recon 2, bit of Kenshin, bit of Racy Helper.


START   equ  29038
GAP     equ  ( 2+7 )
PTR     equ  ( scan - GAP )
SAFE    equ  ( tail - loop + GAP + 1 )
STEP    equ  27883


loop    sub    wipe, @s2
scan    sne.X $START-GAP, $START  
        sub    wipe,  scan
clr     mov.i  wipe,  >PTR
    for 2
        mov.i  *clr,  >PTR
    rof
s2      sne.X *scan, @scan   ; check another pair
        jmp    loop,  scan
        slt.b  scan,  #SAFE    ; ignore self
here    mov.b  scan,  PTR
        jmn.b  loop,  scan
        jmp    loop, }clr
wipe    spl   #STEP, #STEP
        jmp   #0   , {0
tail    dat   #0   , #0
    for   (MAXLENGTH-CURLINE)
     dat.f $0        , $0
    rof

end here

