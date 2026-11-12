;redcode-tiny
;name Disolvente II
;author G.Labarga
;assert CORESIZE==800
;strategy oneshot
;backwards scan, bomb detect

;optem {
;MAXPRIMOS=30
;FACTORES=1
;VARIABLES=2
;PRIMERPRIMO1=1
;ULTIMOPRIMO1=30
;PRIMERPRIMO2=1
;ULTIMOPRIMO2=1
;COMBOS=1500
; }

decoy equ -(60+ 82)     ;(2042 %140))
sstep equ 8*97
d1 equ loop-(2*sstep)
d2 equ loop-(3*sstep)+(1*16)

gate:   dat d2,d1
        dat 0,0
inc:    spl #-(2*sstep)-1,>-(2*sstep)-1
        mov @bptr,>gate
        mov @bptr,}gate
        mov @bptr,>gate
bptr:   djn.b -3,{sbm
for 6
        dat 0,0
rof
dbm:    dat -40,(-gate)
sbm:    spl #-131,(-gate+2)

loop:   add.f inc,gate
scan:   seq.i }gate,>gate
        sne.i *gate,@gate
        djn.b loop,<decoy
        djn.f inc,@scan

end scan

