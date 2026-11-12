;redcode-94
;name Nothing New...
;strategy ...just a mini-HSA adjusted against RotJ.
;author Leonardo H. Liporati
;assert 1
;Scores 210.351 using pmars in permutation mode.
; KOFACOTO-1

SELFS   equ    17
INCR    equ    7

ptr     equ    (bomb-4)

bomb    spl    #1          , }1
wipe    mov    bomb        , {ptr
        mov    }ptr        , }ptr
pptr    jmn.f  wipe        , }ptr
scan    add.a  #INCR+1     , @pptr
        jmz.f  scan        , {ptr
        slt.ab @pptr       , #boot-ptr+2
        jmp    wipe        , {ptr
        djn    scan        , #SELFS
        jmp    scan        , {wipe

boot    mov    boot-1      , @dest
idx for boot-bomb-1
        mov    boot-idx-1  , <dest
    rof
        add.ab #boot-scan-1, dest
dest    jmp   @dest        , 1000

    for 28
        dat >0, >0
    rof

        end boot

