;redcode-odd
;name FiFo
;author Philip Thorne
;strategy Redcoders Frenzy [Round #10 Tri-Tiny] Entry #2/3
;strategy http://de.geocities.com/fizmo_master/cwt.htm
;strategy
;strategy Paper.
;strategy
;assert 1
;       (CORESIZE==800) 
;       (MAXCYCLES==16000)

pStep1  EQU     362
pStep2  EQU     87
bStep   EQU     181
dOff    EQU     474
bOff	EQU     481

bmb:    dat     {0,         1
g0:     mov.i   }-1,        }p1
        mov.i   {-2,        {p2
p2:     spl     @pStep2,    {1
p1:     spl     @pStep1,    >bOff
        mov.i   bmb,        >bStep

start:  spl     2,          >dOff
        spl     1,          >dOff
        spl     1,          >dOff
        jmp     g0,         >dOff

    end start

