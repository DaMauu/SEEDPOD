import { h } from 'vue'
import RuleControl from '../components/RuleControl.vue'

export function useRuleOrSpecial(opts) {
  const specialOf = opts.specialOf
  const targetSite = opts.targetSite
  const targetQ = opts.targetQ
  const targetOpen = opts.targetOpen
  const tpl = opts.tpl
  const tplPreview = opts.tplPreview
  const rx = opts.rx
  const testRx = opts.testRx

function RuleOrSpecial(props) {
  const r = props.r
  const kind = specialOf(r)
  if (kind === 'target') {
    const cur = targetSite.value
    const open = () => { targetQ.value = ''; targetOpen.value = true }
    const kids = []
    kids.push(h('b', {
      id: 'tp-name', class: 'tp-link' + (cur ? '' : ' empty'), title: cur ? cur.host : '',
      onClick: open
    }, cur ? (cur.title || cur.host) : '未选择站点'))
    kids.push(h('button', { class: 'tp-change-text', id: 'tp-change', type: 'button', onClick: open }, cur ? '更改' : '选择'))
    return h('div', { class: 'target-pick' + (cur ? '' : ' empty') }, kids)
  }
  if (kind === 'tpl') {
    return h('div', { class: 'tpl-wrap' }, [
      h('input', { class: 'input', id: 'sub-tpl', value: tpl.value, placeholder: '例：{电影名} | {地区}原盘 | 导演:{导演}', onInput: e => { tpl.value = e.target.value } }),
      h('div', { class: 'tpl-eg', id: 'sub-eg' }, tplPreview.value)
    ])
  }
  if (kind === 'deny') {
    return h('input', { class: 'input', id: 'rx-deny', value: rx.deny, placeholder: '命中就不转载，例：DVDRip|枪版|CAM', onInput: e => { rx.deny = e.target.value } })
  }
  if (kind === 'rx') {
    return h('div', { class: 'rx-test' }, [
      h('input', { class: 'input', id: 'rx-sample', value: rx.sample, placeholder: '粘贴一条标题试一下', onInput: e => { rx.sample = e.target.value } }),
      h('button', { class: 'btn ghost slim', id: 'rx-run', type: 'button', onClick: testRx }, '测试'),
      h('em', { id: 'rx-out', class: rx.outClass }, rx.out)
    ])
  }
  return h(RuleControl, { r })
}
RuleOrSpecial.props = { r: { type: Object, required: true } }

  return RuleOrSpecial
}
