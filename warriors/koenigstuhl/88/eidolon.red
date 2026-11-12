;redcode
;name Eidolon
;author John Metcalf
;strategy scanner
;assert CORESIZE==8000

step    equ    3147
gap     equ    8
first   equ    scan+step*2
safe    equ    inc+4-sptr+gap
clength equ    gap*2+1

; <<<<X<<<<<<<X<<<<
; X scanned, < negative wipe

scan    sub    inc,          sptr
sptr    cmp    first-gap,    first
        slt    #safe,        sptr
        djn    scan,         <3675
        mov    #clength,     count
        mov    sptr,         wptr
wptr    spl    0
wipe    mov    @sbmb,        <wptr
count   djn    wipe,         #0
        jmn    scan,         @scan
sbmb    spl    0
        mov    inc,          <count
inc     dat    #-step,       #-step

        end    sptr

