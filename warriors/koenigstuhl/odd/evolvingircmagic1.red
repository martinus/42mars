;redcode-irc33
;name Evolving IRC Magic1
;author Christian Schmidt
;Strategy qbombing evolved-style paper
;assert 1
;optimax pap

xOff   EQU    528
xSep   EQU    140

start1     spl     #0,      <295
start2     spl     69,      <532
start3     mov.i   }-2,     }-1
start4     mov.i   {463,    <551
start5     mov.i   }-4,     }-3
start6     mov.i   {329,    <422
start7     mov.i   {721,    <315
start8     mov.i   }32,     <571

start9      mov.i   {xOff+(1*xSep), <xOff+(1*xSep*2)
start10     mov.i   {xOff+(2*xSep), <xOff+(2*xSep*2)
start11     mov.i   {xOff+(3*xSep), <xOff+(3*xSep*2)
start12     mov.i   {xOff+(4*xSep), <xOff+(4*xSep*2)
start13     mov.i   {xOff+(5*xSep), <xOff+(5*xSep*2)
start14     mov.i   {xOff+(6*xSep), <xOff+(6*xSep*2)
start15     mov.i   {xOff+(7*xSep), <xOff+(7*xSep*2)
start16     mov.i   {xOff+(8*xSep), <xOff+(8*xSep*2)
start17     mov.i   {xOff+(9*xSep), <xOff+(9*xSep*2)
start18     mov.i   {xOff+(10*xSep), <xOff+(10*xSep*2)
start19     mov.i   {xOff+(11*xSep), <xOff+(11*xSep*2)
nostart     djn.f   start1,     <377

     end     start1
