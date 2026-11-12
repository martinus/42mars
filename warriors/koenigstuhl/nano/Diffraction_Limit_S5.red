;redcode-nano
;name Diffraction Limit S5
;author inversed
;strategy Scanner
;date 2022.09.18
;assert CORESIZE == 80

; Optimized from scratch, but ended up being nearly identical to 
; Bombus Lepidus. The differences are subtle, but the score boost
; is surprisingly big.

org     1

sub     # -5  ,  # 12
jmz.f     -1  ,  @ -1
mov        2  ,  > -2
djn.f     -2  ,  < -5
mov.i   #  4  ,    -1
