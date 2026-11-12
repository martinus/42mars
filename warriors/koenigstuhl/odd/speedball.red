;redcode-rf20
;name Speedball
;author Roy van Rijn
;assert 1

bOff   equ    start+400

PA00   spl    #  199 , #   17  ;A-field flip $ into # (2 AP)
PA01   jmp    $   11 , <   47  ;Change A-Field @ into $ (4 AP)
PA02   mov.i  *   -3 , >   -3  ;Change B-Field } into > (4 AP)
PA03   mul.ab #  367 , $    0
PA04   spl    @  -10 , #   10
PA05   mov.i  > 2667 , }   -5
PA06   mov.i  # 1143 , $   -2
PA07   mod.f  $   -1 , $   16
PA08   sne.b  $   22 , $ 3044
PA09   sub.a  $    0 , $ 2365

;prescan
;Didn't include this in the final warrior
;What it did was scan at this fase, and then setting the clears pointer
;Good idea, and it worked, but the time between finding something
;and then booting the clear+removing this mess
;was just to big to be effective
;so now its just a plain clear...!

;create our monster:

start   mov.i   PA00            , bOff

        mov.a   PA04            , PA02
        mov.ab  PA04            , PA02
        mov.i   PA02            , bOff+1

        mov.i   PA01            , bOff+2
        mov.x   PA06            , bOff+2

        mov.i   PA00            , bOff+11 ;set bomb
        mov.ba  PA00            , bOff+11

        sub.f   PA02            , bOff-9 ;set gate
        sub.f   PA02            , bOff-9

;created the warrior!
;now clear and start it!

	spl 1
	spl 1
	spl 1
        mov.i   clear           , > ptr1
        mov.i   clear           , > ptr1
        mov.i   clear           , > ptr1
        mov.i   clear           , > ptr1

ptr1    jmp     bOff            , PA00
clear	dat	0		, 0


; The AP list:

;1) Flipping A-Field from PA00                  : 2 AP
;2) Changed A-Modifier from PA01            : 4 AP
;3) Changed B-Modifier from PA02            : 4 AP

;   Total used AP's                             : 10 AP


end start
