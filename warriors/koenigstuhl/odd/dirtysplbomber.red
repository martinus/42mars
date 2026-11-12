;redcode-94
;name The Dirty Spl Bomber
;author Christian Schmidt
;strategy incendary bomber with spl-only clear
;assert 1


bstep equ 2394 ; 7629 ; 7036
bhop  equ 7953 ; 7965 ; 7969
btime equ 1378 ; 1427 ; 1323
bgate equ    3 ;    4 ;    3

bomb    spl    #1,bhop     
        add   #bstep, 1
        mov     bmov, >2-bstep*btime
        mov     bomb, @-1
        jmz       -3, #0   
        mov  bdat,>bomb-bgate
        djn.f  -1,>bomb-bgate
bdat    spl #2667, 2+bgate-bomb
bmov    mov -bhop,>-bhop   

end bomb
